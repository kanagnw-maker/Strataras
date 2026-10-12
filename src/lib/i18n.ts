export const LANGUAGES = [
  { code: "el", label: "Ελληνικά", flag: "🇬🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export const DEFAULT_LANG: LangCode = "el";

export function pickLocalized(value: unknown, lang: LangCode): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, string | undefined>;
  return obj[lang] || obj["el"] || obj["en"] || Object.values(obj)[0] || "";
}

export const UI = {
  el: {
    menu: "Μενού", admin: "Διαχείριση", login: "Σύνδεση", logout: "Αποσύνδεση",
    email: "Email", password: "Κωδικός", signIn: "Σύνδεση", welcome: "Καλώς ήρθατε",
    categories: "Κατηγορίες", products: "Προϊόντα", addCategory: "Νέα κατηγορία",
    addProduct: "Νέο προϊόν", edit: "Επεξεργασία", delete: "Διαγραφή",
    save: "Αποθήκευση", cancel: "Άκυρο", active: "Ενεργό", inactive: "Ανενεργό",
    name: "Όνομα", description: "Περιγραφή", price: "Τιμή", image: "Φωτογραφία",
    sortOrder: "Σειρά", category: "Κατηγορία", upload: "Ανέβασμα",
    noProducts: "Δεν υπάρχουν προϊόντα σε αυτή την κατηγορία.",
    selectLanguage: "Γλώσσα", deleteConfirm: "Σίγουρα;",
    tagline: "Διαφορετικοί άνθρωποι.. Παράταιρα πιάτα.. Μια παρέα!",
    open: "Ανοιχτά", closed: "Κλειστά", hours: "Ώρες λειτουργίας",
    opensAt: "Ανοίγει", closesAt: "Κλείνει",
    mon: "Δευ", tue: "Τρί", wed: "Τετ", thu: "Πέμ", fri: "Παρ", sat: "Σάβ", sun: "Κυρ",
    outOfStock: "Εξαντλήθηκε", stock: "Απόθεμα",
  },
  en: {
    menu: "Menu", admin: "Admin", login: "Login", logout: "Logout",
    email: "Email", password: "Password", signIn: "Sign in", welcome: "Welcome",
    categories: "Categories", products: "Products", addCategory: "New category",
    addProduct: "New product", edit: "Edit", delete: "Delete",
    save: "Save", cancel: "Cancel", active: "Active", inactive: "Inactive",
    name: "Name", description: "Description", price: "Price", image: "Image",
    sortOrder: "Order", category: "Category", upload: "Upload",
    noProducts: "No products in this category yet.",
    selectLanguage: "Language", deleteConfirm: "Are you sure?",
    tagline: "Different people. Incongruous dishes.. A group of friends!",
    open: "Open", closed: "Closed", hours: "Opening hours",
    opensAt: "Opens", closesAt: "Closes",
    mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
    outOfStock: "Sold out", stock: "Stock",
  },
  de: { menu: "Menü", admin: "Admin", login: "Anmelden", logout: "Abmelden", email: "E-Mail", password: "Passwort", signIn: "Anmelden", welcome: "Willkommen", categories: "Kategorien", products: "Produkte", addCategory: "Neue Kategorie", addProduct: "Neues Produkt", edit: "Bearbeiten", delete: "Löschen", save: "Speichern", cancel: "Abbrechen", active: "Aktiv", inactive: "Inaktiv", name: "Name", description: "Beschreibung", price: "Preis", image: "Bild", sortOrder: "Reihenfolge", category: "Kategorie", upload: "Hochladen", noProducts: "Noch keine Produkte.", selectLanguage: "Sprache", deleteConfirm: "Sind Sie sicher?", tagline: "Unterschiedliche Menschen. Ungewöhnliche Gerichte. Eine Gruppe von Freunden!", open: "Geöffnet", closed: "Geschlossen", hours: "Öffnungszeiten", opensAt: "Öffnet", closesAt: "Schließt", mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr", sat: "Sa", sun: "So", outOfStock: "Ausverkauft", stock: "Bestand" },
  tr: { menu: "Menü", admin: "Yönetim", login: "Giriş", logout: "Çıkış", email: "E-posta", password: "Şifre", signIn: "Giriş", welcome: "Hoş geldiniz", categories: "Kategoriler", products: "Ürünler", addCategory: "Yeni kategori", addProduct: "Yeni ürün", edit: "Düzenle", delete: "Sil", save: "Kaydet", cancel: "İptal", active: "Aktif", inactive: "Pasif", name: "İsim", description: "Açıklama", price: "Fiyat", image: "Resim", sortOrder: "Sıra", category: "Kategori", upload: "Yükle", noProducts: "Henüz ürün yok.", selectLanguage: "Dil", deleteConfirm: "Emin misiniz?", tagline: "Farklı insanlar. Birbirine uymayan yemekler.. Bir grup arkadaş!", open: "Açık", closed: "Kapalı", hours: "Çalışma saatleri", opensAt: "Açılış", closesAt: "Kapanış", mon: "Pzt", tue: "Sal", wed: "Çar", thu: "Per", fri: "Cum", sat: "Cmt", sun: "Paz", outOfStock: "Tükendi", stock: "Stok" },
  fr: { menu: "Menu", admin: "Admin", login: "Connexion", logout: "Déconnexion", email: "E-mail", password: "Mot de passe", signIn: "Se connecter", welcome: "Bienvenue", categories: "Catégories", products: "Produits", addCategory: "Nouvelle catégorie", addProduct: "Nouveau produit", edit: "Modifier", delete: "Supprimer", save: "Enregistrer", cancel: "Annuler", active: "Actif", inactive: "Inactif", name: "Nom", description: "Description", price: "Prix", image: "Image", sortOrder: "Ordre", category: "Catégorie", upload: "Téléverser", noProducts: "Aucun produit pour le moment.", selectLanguage: "Langue", deleteConfirm: "Êtes-vous sûr ?", tagline: "Des personnes différentes. Des plats incongrus… Un groupe d’amis !", open: "Ouvert", closed: "Fermé", hours: "Horaires", opensAt: "Ouvre", closesAt: "Ferme", mon: "Lun", tue: "Mar", wed: "Mer", thu: "Jeu", fri: "Ven", sat: "Sam", sun: "Dim", outOfStock: "Épuisé", stock: "Stock" },
  es: { menu: "Menú", admin: "Admin", login: "Acceder", logout: "Salir", email: "Correo", password: "Contraseña", signIn: "Acceder", welcome: "Bienvenido", categories: "Categorías", products: "Productos", addCategory: "Nueva categoría", addProduct: "Nuevo producto", edit: "Editar", delete: "Eliminar", save: "Guardar", cancel: "Cancelar", active: "Activo", inactive: "Inactivo", name: "Nombre", description: "Descripción", price: "Precio", image: "Imagen", sortOrder: "Orden", category: "Categoría", upload: "Subir", noProducts: "Aún no hay productos.", selectLanguage: "Idioma", deleteConfirm: "¿Está seguro?", tagline: "Personas diferentes. Platos incongruentes. ¡Un grupo de amigos!", open: "Abierto", closed: "Cerrado", hours: "Horario", opensAt: "Abre", closesAt: "Cierra", mon: "Lun", tue: "Mar", wed: "Mié", thu: "Jue", fri: "Vie", sat: "Sáb", sun: "Dom", outOfStock: "Agotado", stock: "Existencias" },
} as const;

export function t(lang: LangCode, key: keyof typeof UI.el): string {
  return (UI[lang] as Record<string, string>)[key] ?? UI.el[key];
}
