import { storefrontUrl } from "./supabase-config.js";
import { connect, mediaBucket, mediaUrl } from "./backend.js";
import { categories } from "./categories.js";

const byId = id => document.getElementById(id);
byId("storefront-link").href = storefrontUrl;
const productForm = byId("product-form");
const heroForm = byId("hero-form");
const status = byId("status");
const editor = byId("editor");
const labels = new Map(categories.map(([id, name]) => [id, name]));
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const mime = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
let client;
let products = [];
let hero;
let editing;

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

function notice(message) {
  status.textContent = message;
}

function addOptions(select) {
  for (const [id, name] of labels) select.add(new Option(name, id));
}

function button(label, action) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", action);
  return element;
}

function renderProducts() {
  const list = byId("products");
  const category = byId("filter").value;
  const visible = products.filter(product => !category || category === product.category);
  list.replaceChildren();
  if (!visible.length) list.textContent = "Nenhuma roupa nesta categoria.";
  for (const product of visible) {
    const row = document.createElement("div");
    row.className = "product-row";
    const summary = document.createElement("div");
    summary.className = "product-summary";
    const image = document.createElement("img");
    image.alt = "";
    image.src = mediaUrl(client, product.image);
    const description = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = product.name;
    const detail = document.createElement("small");
    detail.textContent = labels.get(product.category) + " · " + money.format(product.price / 100);
    description.append(name, detail);
    summary.append(image, description);
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(button("Editar", () => editProduct(product)), button("Remover", async event => {
      if (!confirm("Remover “" + product.name + "” da vitrine?")) return;
      event.currentTarget.disabled = true;
      try {
        checked(await client.from("moda_products").delete().eq("id", product.id).select("id").single());
        products = products.filter(item => item.id !== product.id);
        renderProducts();
        notice("Roupa removida da vitrine.");
      } catch {
        renderProducts();
        notice("Não foi possível remover a roupa.");
      }
    }));
    row.append(summary, actions);
    list.append(row);
  }
}

function editProduct(product) {
  editing = product;
  productForm.reset();
  byId("product-error").textContent = "";
  byId("editor-title").textContent = product ? "Editar roupa" : "Adicionar roupa";
  const fields = productForm.elements;
  fields.image.required = !product;
  fields.category.value = product?.category ?? (byId("filter").value || categories[0][0]);
  if (product) {
    fields.name.value = product.name;
    fields.price.value = (product.price / 100).toFixed(2);
    fields.color.value = product.color;
    fields.colorHex.value = product.color_hex;
    fields.sizes.value = product.sizes.join(", ");
  }
  editor.showModal();
}

async function upload(file, folder) {
  if (!mime[file.type] || file.size > 5 * 1024 * 1024) throw new Error("Escolha uma imagem JPG, PNG ou WebP de até 5 MB.");
  const path = folder + "/" + crypto.randomUUID() + "." + mime[file.type];
  checked(await client.storage.from(mediaBucket).upload(path, file, { contentType: file.type }));
  return path;
}

function renderHero() {
  for (const device of ["desktop", "mobile"]) {
    byId(device + "-preview").src = mediaUrl(client, hero[device] ?? "hero-" + device + ".webp");
  }
}

async function loadDashboard(session) {
  const dashboard = byId("dashboard");
  dashboard.hidden = true;
  byId("login").hidden = Boolean(session);
  byId("logout").hidden = !session;
  if (!session) {
    notice("Entre para editar a vitrine.");
    return;
  }
  notice("Conferindo acesso…");
  const membership = checked(await client.from("moda_catalog_admins").select("user_id").eq("user_id", session.user.id).maybeSingle());
  if (!membership) {
    notice("Esta conta ainda não tem acesso ao painel.");
    return;
  }
  const [productResult, heroResult] = await Promise.all([
    client.from("moda_products").select("*").order("name"),
    client.from("moda_hero").select("*").eq("id", true).single()
  ]);
  products = checked(productResult);
  hero = checked(heroResult);
  heroForm.reset();
  renderProducts();
  renderHero();
  dashboard.hidden = false;
  notice("");
}

async function submit(event, onSubmit, onError) {
  event.preventDefault();
  const control = event.submitter;
  if (control.disabled) return;
  control.disabled = true;
  try { await onSubmit(event.currentTarget.elements); }
  catch (error) { onError(error); }
  finally { control.disabled = false; }
}

addOptions(byId("filter"));
addOptions(productForm.elements.category);
byId("filter").addEventListener("change", renderProducts);
byId("new-product").addEventListener("click", () => editProduct());
const cancel = byId("cancel");
cancel.addEventListener("click", () => editor.close());
editor.addEventListener("cancel", event => {
  if (cancel.disabled) event.preventDefault();
});
byId("login").addEventListener("submit", event => submit(event, async fields => {
  const { session } = checked(await client.auth.signInWithPassword({ email:fields.email.value.trim(), password:fields.password.value }));
  fields.password.value = "";
  await loadDashboard(session);
}, () => notice("Não foi possível entrar. Confira o e-mail, a senha e a conexão.")));

byId("logout").addEventListener("click", async event => {
  const control = event.currentTarget;
  control.disabled = true;
  try {
    checked(await client.auth.signOut());
    await loadDashboard(null);
  } catch {
    notice("Não foi possível sair. Tente novamente.");
  } finally {
    control.disabled = false;
  }
});

productForm.addEventListener("submit", async event => {
  cancel.disabled = true;
  try {
    await submit(event, saveProduct, error => {
      byId("product-error").textContent = error.message || "Não foi possível salvar a roupa.";
    });
  } finally {
    cancel.disabled = false;
  }
});

async function saveProduct(fields) {
  const sizes = [...new Set(fields.sizes.value.split(",").map(size => size.trim()).filter(Boolean))];
  if (!fields.name.value.trim() || !fields.color.value.trim() || !sizes.length || sizes.length > 20 ||
      sizes.some(size => !/^[\p{L}\p{N} .-]{1,16}$/u.test(size))) {
    throw new Error("Confira o nome, a cor e os tamanhos informados.");
  }
  const price = Math.round(Number(fields.price.value) * 100);
  const values = {
    name:fields.name.value.trim(), category:fields.category.value, price,
    color:fields.color.value.trim(), color_hex:fields.colorHex.value, sizes,
    image:fields.image.files[0] ? await upload(fields.image.files[0], "products") : editing.image
  };
  const query = client.from("moda_products");
  const saved = checked(await (editing
    ? query.update(values).eq("id", editing.id)
    : query.insert({...values, id:crypto.randomUUID()})).select("*").single());
  products = [...products.filter(item => item.id !== saved.id), saved].sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));
  renderProducts();
  editor.close();
  notice("Roupa salva na vitrine.");
}

heroForm.addEventListener("submit", event => submit(event, async fields => {
  const update = {};
  for (const [device, reset] of [["desktop", "resetDesktop"], ["mobile", "resetMobile"]]) {
    if (fields[device].files[0]) update[device] = await upload(fields[device].files[0], "hero");
    else if (fields[reset].checked) update[device] = null;
  }
  if (!Object.keys(update).length) {
    notice("Escolha uma nova imagem ou marque a opção de restaurar a arte original.");
    return;
  }
  hero = checked(await client.from("moda_hero").update(update).eq("id", true).select("*").single());
  heroForm.reset();
  renderHero();
  notice("Banners atualizados na vitrine.");
}, error => notice(error.message || "Não foi possível salvar os banners.")));

byId("reset-password").addEventListener("click", async event => {
  const email = byId("login").elements.email;
  if (!email.reportValidity()) return;
  const control = event.currentTarget;
  control.disabled = true;
  try {
    checked(await client.auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: "https://moda-infatil-6bis.vercel.app/"
    }));
    notice("Confira sua caixa de entrada e o spam para abrir o link de recuperação.");
  } catch {
    notice("O Supabase não conseguiu enviar o link. Confira a configuração de e-mail do projeto ou tente novamente em instantes.");
  } finally {
    control.disabled = false;
  }
});

byId("new-password").addEventListener("submit", event => submit(event, async fields => {
  checked(await client.auth.updateUser({password: fields.password.value}));
  fields.password.value = "";
  checked(await client.auth.signOut({scope:"local"}));
  byId("new-password").hidden = true;
  await loadDashboard(null);
  notice("Senha atualizada. Entre com a nova senha.");
}, () => notice("Não foi possível salvar a senha. Confira se o link ainda está válido e use uma senha de pelo menos 8 caracteres.")));

try {
  client = await connect();
  if (client) {
    let recovering = new URLSearchParams(location.hash.slice(1)).get("type") === "recovery";
    client.auth.onAuthStateChange(event => {
      if (event !== "PASSWORD_RECOVERY") return;
      recovering = true;
      byId("login").hidden = true;
      byId("dashboard").hidden = true;
      byId("logout").hidden = true;
      byId("new-password").hidden = false;
      notice("Defina uma nova senha para acessar o painel.");
    });
    const { session } = checked(await client.auth.getSession());
    if (recovering && !session) {
      byId("new-password").hidden = true;
      await loadDashboard(null);
      notice("O link expirou. Solicite outro pelo botão Esqueci minha senha.");
    } else if (!recovering) await loadDashboard(session);
  } else {
    notice("O painel aguarda a configuração do Supabase.");
  }
} catch {
  notice("Não foi possível conectar ao painel. Confira a configuração e tente novamente.");
}
