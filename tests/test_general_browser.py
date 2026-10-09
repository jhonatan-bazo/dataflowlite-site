"""Pruebas end-to-end de la demo CSV general."""
import csv, io, threading, unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

class GeneralTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0),partial(QuietHandler,directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.http.serve_forever,daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=5)
    def setUp(self):
        self.context=self.browser.new_context(accept_downloads=True)
        self.page=self.context.new_page()
        self.errors=[]
        self.page.on("pageerror", lambda exc: self.errors.append(str(exc)))
        response=self.page.goto(self.base+"/general.html",wait_until="load")
        self.assertEqual(response.status,200)
    def tearDown(self):
        self.assertEqual(self.errors,[])
        self.context.close()
    def upload(self,content):
        self.page.locator("#file").set_input_files({
            "name":"datos.csv","mimeType":"text/csv","buffer":content})
        expect(self.page.locator("#validate")).to_be_enabled()
    def export(self,id):
        with self.page.expect_download() as download:
            self.page.locator(id).click()
        with open(download.value.path(),"rb") as stream:
            return list(csv.reader(io.StringIO(stream.read().decode("utf-8-sig"))))
    def test_two_column_generic_and_export(self):
        self.upload(b"Usuario;Estado\nAna;Activo\nLuis;Inactivo")
        expect(self.page.locator("#rules tr")).to_have_count(2)
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("2 válidos")
        self.assertEqual(self.export("#download-valid"),
          [["Usuario","Estado"],["Ana","Activo"],["Luis","Inactivo"]])
    def test_types_duplicates_and_original_columns(self):
        self.upload(b"ID;Correo;Monto;Fecha\n1;ana@example.com;12;2026-02-28\n2;mal;13;2026-02-30\n1;ana@example.com;12;2026-02-28")
        self.page.get_by_role("checkbox",name="único para ID").check()
        self.page.get_by_role("combobox",name="Tipo de Correo").select_option("email")
        self.page.get_by_role("combobox",name="Tipo de Fecha").select_option("date")
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("0 válidos")
        expect(self.page.locator("#result-rows")).to_contain_text("duplicado")
        expect(self.page.locator("#result-rows")).to_contain_text("fecha inexistente")
        self.assertEqual(self.export("#download-errors")[0],["Fila origen","ID","Correo","Monto","Fecha","Errores"])
    def test_rules_update_invalidates_and_sample_replaced(self):
        self.page.locator("#sample").click()
        expect(self.page.locator("#rules")).to_contain_text("Cliente")
        self.upload(b"A,B\nfoo,12\nbar,13")
        self.assertNotIn("Cliente",self.page.locator("#rules").inner_text())
        self.page.locator("#validate").click()
        expect(self.page.locator("#download-valid")).to_be_enabled()
        self.page.get_by_role("checkbox",name="obligatorio para B").check()
        expect(self.page.locator("#download-valid")).to_be_disabled()
        self.page.get_by_role("combobox",name="Tipo de B").select_option("integer")
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("2 válidos")
    def test_malformed_rows_are_reported_without_losing_valid_rows(self):
        self.upload(b"ID;Nombre;Edad\n1;Ana;20\n2;Beto\n3;Cami;30;EXTRA")
        expect(self.page.locator("#source-info")).to_contain_text("2 filas con cantidad de columnas diferente")
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("1 válidos")
        expect(self.page.locator("#summary")).to_contain_text("2 con errores")
        self.assertEqual(self.export("#download-valid"),[
          ["ID","Nombre","Edad"],["1","Ana","20"]
        ])
        summary=self.export("#download-errors")
        self.assertEqual(summary[0],[
          "Fila origen","ID","Nombre","Edad","Columnas adicionales (JSON)","Errores"
        ])
        self.assertEqual(summary[1][3],"")
        self.assertEqual(summary[2][4],'["EXTRA"]')
        self.assertIn("Estructura:",summary[1][-1])

    def test_sample_has_explicit_rules_and_flags_errors(self):
        self.page.locator("#sample").click()
        expect(self.page.get_by_role("combobox",name="Tipo de Correo")).to_have_value("email")
        expect(self.page.get_by_role("combobox",name="Tipo de Fecha")).to_have_value("date")
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("3 con errores")
        expect(self.page.locator("#result-rows")).to_contain_text("correo electrónico inválido")

    def test_single_column_and_xss_safety(self):
        self.upload(b"Mensaje\n'=2+3\nHola")
        self.page.locator("#validate").click()
        expect(self.page.locator("#summary")).to_contain_text("2 válidos")
        self.assertEqual(self.export("#download-valid")[0],["Mensaje"])
        self.assertEqual(self.page.locator("img").count(),0)

if __name__=="__main__":
    unittest.main()
