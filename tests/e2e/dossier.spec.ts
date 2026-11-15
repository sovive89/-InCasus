import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const fixture = JSON.parse(await readFile("/tmp/incasus-e2e-fixtures.json", "utf8"));
async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/auth");
  await page.getByLabel("E-mail", { exact: true }).fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
test("advogado cadastra nota, revisa, consulta histórico e recebe original persistente", async ({
  page,
}, testInfo) => {
  await login(page, fixture.a);
  await expect(page).toHaveURL(/\/advogado\/dashboard/);
  await page.goto(`/advogado/clientes/${fixture.clientId}`);
  await expect(
    page.getByRole("heading", { name: "Cliente fictício de integração", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Documentos e notas do caso" }).click();
  const title = `Nota criada no navegador ${testInfo.project.name}`;
  await page.getByRole("button", { name: "Nova nota", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Nova nota interna" });
  await dialog.getByLabel("Título (obrigatório)", { exact: true }).fill(title);
  await dialog
    .getByLabel("Nota (obrigatória)", { exact: true })
    .fill("Primeiro texto do navegador.");
  await dialog.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page.getByText("Nota interna salva.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Documentos e notas do caso" }).click();
  await expect(page.getByText("Primeiro texto do navegador.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Editar nota ${title}`, exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Editar nota interna" });
  await dialog
    .getByLabel("Nota (obrigatória)", { exact: true })
    .fill("Segundo texto do navegador.");
  await dialog.getByRole("button", { name: "Salvar nota", exact: true }).click();
  await expect(page.getByText("Nova versão da nota salva.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Histórico da nota ${title}`, exact: true }).click();
  const history = page.getByRole("dialog", { name: "Histórico da nota" });
  await expect(history.getByText("Primeiro texto do navegador.", { exact: true })).toBeVisible();
  await expect(history.getByText("Segundo texto do navegador.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Anexar original", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Anexar original ao caso" });
  const fileTitle = `Original do navegador ${testInfo.project.name}`,
    bytes = Buffer.from("ORIGINAL FICTÍCIO DO NAVEGADOR.\n");
  await dialog
    .getByLabel("Arquivo (até 10 MB)", { exact: true })
    .setInputFiles({ name: "original-navegador.txt", mimeType: "text/plain", buffer: bytes });
  await dialog.getByLabel("Título (obrigatório)", { exact: true }).fill(fileTitle);
  await dialog
    .getByLabel("Origem (obrigatória)", { exact: true })
    .fill("Teste de integração no navegador");
  await dialog.getByRole("button", { name: "Enviar e conferir original", exact: true }).click();
  await expect(
    page.getByText("Original conferido e registrado no caso.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Documentos e notas do caso" }).click();
  const article = page.getByRole("article", { name: fileTitle, exact: true });
  await expect(article).toBeVisible();
  await article.getByRole("button", { name: "Preparar download", exact: true }).click();
  const download = page.waitForEvent("download");
  await article.getByRole("link", { name: "Baixar original agora", exact: true }).click();
  const received = await download;
  expect(received.suggestedFilename()).toBe("original-navegador.txt");
  const stream = await received.createReadStream();
  if (!stream) throw new Error("Download sem conteúdo");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(createHash("sha256").update(Buffer.concat(chunks)).digest("hex")).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/prontuario-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("cliente não abre a área profissional", async ({ page }) => {
  await login(page, fixture.customer);
  await expect(page).toHaveURL(/\/cliente\/?$/);
  await page.goto(`/advogado/clientes/${fixture.clientId}`);
  await expect(page).toHaveURL(/\/cliente\/?$/);
  await expect(page.getByRole("button", { name: "Nova nota", exact: true })).toHaveCount(0);
  await expect(page.getByText("Segunda versão preservada.", { exact: true })).toHaveCount(0);
});

test("cadastro de cliente e inquérito persiste após recarregar", async ({ page }, testInfo) => {
  await login(page, fixture.a);
  await expect(page).toHaveURL(/\/advogado\/dashboard/);
  await page.goto("/advogado/clientes");
  const name = `Cliente do navegador ${testInfo.project.name} ${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Novo cliente", exact: true });
  await dialog.getByLabel("Nome", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Novo caso", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Novo caso", exact: true });
  await dialog
    .getByLabel("Título do caso", { exact: true })
    .fill("Inquérito cadastrado pelo navegador");
  await dialog.getByLabel("Matéria jurídica", { exact: true }).fill("Criminal");
  await dialog.getByLabel("Etapa", { exact: true }).selectOption("investigation");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inquérito cadastrado pelo navegador", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("Inquérito policial", { exact: true })).toBeVisible();
});
