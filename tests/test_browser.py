"""Pruebas reales del sitio estático en Chromium usando Playwright."""
import csv
import io
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHTTP(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHTTP, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def setUp(self):
        self.context = self.browser.new_context(accept_downloads=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda err: self.errors.append(str(err)))
        response = self.page.goto(self.base + "/demo.html", wait_until="load")
        self.assertEqual(response.status, 200)

    def tearDown(self):
        self.assertEqual(self.errors, [], "Errores JavaScript: " + str(self.errors))
        self.context.close()

    def load_example(self):
        self.page.locator("#sample").click()
        expect(self.page.locator("#validate")).to_be_enabled()

    def validate(self):
        self.page.locator("#validate").click()
        expect(self.page.locator("#result")).to_be_visible()

    def upload(self, raw):
        self.page.locator("#file").set_input_files({
            "name": "datos.csv", "mimeType": "text/csv", "buffer": raw
        })

    def read_download(self, button):
        with self.page.expect_download() as pending:
            self.page.locator(button).click()
        with open(pending.value.path(), "rb") as stream:
            return list(csv.reader(io.StringIO(stream.read().decode("utf-8-sig"))))

    def test_landing_navigation(self):
        response = self.page.goto(self.base + "/index.html")
        self.assertEqual(response.status, 200)
        expect(self.page.locator("#precio-piloto")).to_contain_text("S/49")
        expect(self.page.locator("#precio-piloto")).to_contain_text("no hay ventas ni reservas")
        self.assertEqual(self.page.locator("a[href^='mailto:']").count() > 0, True)
        self.page.get_by_role("link", name="Plantilla de inventario").first.click()
        expect(self.page).to_have_url(self.base + "/demo.html")
        expect(self.page.locator("#mode-status")).to_contain_text("SKU único")

    def test_default_blocks_both_duplicates(self):
        self.load_example()
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("1 válido")
        expect(self.page.locator("#summary")).to_contain_text("3 con errores")
        expect(self.page.locator("#rows tr").nth(1)).to_contain_text("precios diferentes")
        expect(self.page.locator("#rows tr").nth(3)).to_contain_text("precios diferentes")
        self.assertEqual(self.read_download("#download"), [
            ["SKU", "Nombre", "Precio"],
            ["SKU-102", "Teclado USB", "42.50"]
        ])

    def test_checkbox_accepts_variants_and_invalidates_old_results(self):
        self.load_example()
        self.validate()
        self.page.locator("#allow-variants").check()
        expect(self.page.locator("#result")).to_be_hidden()
        expect(self.page.locator("#download")).to_be_disabled()
        expect(self.page.locator("#mode-status")).to_contain_text("se permiten variaciones")
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("3 válidos")
        expect(self.page.locator("#summary")).to_contain_text("2 con advertencias")
        self.assertEqual(self.read_download("#download")[1:], [
            ["SKU-102", "Teclado USB", "42.50"],
            ["SKU-205", "Mouse óptico", "19.90"],
            ["SKU-205", "Mouse extra", "21.00"]
        ])
        self.assertEqual(len(self.read_download("#download-errors")), 2)
        self.page.locator("#allow-variants").uncheck()
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("1 válido")

    def test_real_file_replaces_example_headers(self):
        self.load_example()
        expect(self.page.locator("#sku")).to_contain_text("Codigo")
        self.upload(b"Articulo;Detalle;Monto\nX1;Manzana;8.90\nX2;Pera;5.00")
        expect(self.page.locator("#source-info")).to_contain_text("datos.csv")
        expect(self.page.locator("#source-info")).to_contain_text("Articulo | Detalle | Monto")
        self.assertNotIn("Codigo", self.page.locator("#sku").inner_text())
        expect(self.page.locator("#preview-body")).to_contain_text("Manzana")
        self.page.locator("#sku").select_option("0")
        self.page.locator("#name").select_option("1")
        self.page.locator("#price").select_option("2")
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("2 válidos")

    def test_excel_cp1252_and_separator_hint(self):
        self.upload("sep=;\nCódigo;Descripción;Precio\nX;Lápiz;10,90".encode("cp1252"))
        expect(self.page.locator("#source-info")).to_contain_text("windows-1252")
        self.page.locator("#sku").select_option("0")
        self.page.locator("#name").select_option("1")
        self.page.locator("#price").select_option("2")
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("1 válido")

    def test_same_variant_is_rejected(self):
        self.upload(b"sku;name;price\nA;Uno;19.90\na;uno;19,9\n")
        expect(self.page.locator("#validate")).to_be_enabled()
        self.page.locator("#allow-variants").check()
        self.validate()
        expect(self.page.locator("#summary")).to_contain_text("0 válidos")
        expect(self.page.locator("#rows tr").first).to_contain_text("Registro duplicado")
        expect(self.page.locator("#download")).to_be_disabled()

    def test_invalid_upload_clears_old_result(self):
        self.load_example()
        self.validate()
        self.upload(b"sku;name;price\nA;Uno;2\nB;Dos;3;extra\n")
        expect(self.page.locator("#validate")).to_be_disabled()
        expect(self.page.locator("#result")).to_be_hidden()
        expect(self.page.locator("#feedback")).to_contain_text("columnas")
        expect(self.page.locator("#source-info")).to_contain_text("No se cargó")
        self.assertNotIn("Codigo", self.page.locator("#sku").inner_text())

    def test_utf8_injection_and_mobile(self):
        self.upload(b"sku;name;price\nA;\xff;20\n")
        expect(self.page.locator("#source-info")).to_contain_text("windows-1252")
        expect(self.page.locator("#validate")).to_be_enabled()
        self.upload(b'sku;name;price\n"=1+1";"<img src=x onerror=alert(1)>";10\n')
        expect(self.page.locator("#validate")).to_be_enabled()
        self.validate()
        self.assertEqual(self.page.locator("#rows img").count(), 0)
        self.assertEqual(self.read_download("#download")[1][0], "'=1+1")
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.reload()
        self.load_example()
        self.page.locator("#allow-variants").check()
        self.validate()
        self.assertFalse(self.page.evaluate(
            "() => document.documentElement.scrollWidth > window.innerWidth + 1"
        ), "Desbordamiento horizontal en móvil")

if __name__ == "__main__":
    unittest.main()
