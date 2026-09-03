"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChevronLeft,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PackagePlus,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
} from "lucide-react";

type Product = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  stock: number;
  unit: string;
  reorderPoint: number;
  salePriceRial: string;
};

type DialogName = "receipt" | "product" | null;

type DashboardResponse = {
  products: Product[];
  metrics?: {
    salesToday?: string;
  };
};

const demoProducts: Product[] = [
  { id: "1", sku: "SCH-LC1D25", name: "کنتاکتور اشنایدر LC1D25", brand: "اشنایدر", category: "کنتاکتور", stock: 24, unit: "عدد", reorderPoint: 8, salePriceRial: "48500000" },
  { id: "2", sku: "ABB-S201-C16", name: "کلید مینیاتوری ABB S201 C16", brand: "ABB", category: "کلید و فیوز", stock: 7, unit: "عدد", reorderPoint: 10, salePriceRial: "12900000" },
  { id: "3", sku: "LS-MC-18A", name: "کنتاکتور LS MC-18a", brand: "LS", category: "کنتاکتور", stock: 41, unit: "عدد", reorderPoint: 12, salePriceRial: "18400000" },
  { id: "4", sku: "KBL-2.5-100", name: "کابل افشان ۲.۵ مسی", brand: "خراسان", category: "کابل و سیم", stock: 0, unit: "حلقه", reorderPoint: 3, salePriceRial: "75000000" },
  { id: "5", sku: "SCH-LC1D09", name: "کنتاکتور اشنایدر LC1D09", brand: "اشنایدر", category: "کنتاکتور", stock: 16, unit: "عدد", reorderPoint: 6, salePriceRial: "22800000" },
];

const formatNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
// Money arrives as an exact decimal string (BigInt in the database); convert to Toman with BigInt math, not floats.
const formatMoney = (value: string | number) => `${formatNumber(Number((BigInt(value) + 5n) / 10n))} تومان`;

function stockStatus(product: Product) {
  if (product.stock === 0) return { label: "ناموجود", className: "out" };
  if (product.stock <= product.reorderPoint) return { label: "نیاز به سفارش", className: "low" };
  return { label: "موجود", className: "ok" };
}

export default function Dashboard() {
  const [products, setProducts] = useState(demoProducts);
  const [salesToday, setSalesToday] = useState<string | null>(null);
  const [modal, setModal] = useState<DialogName>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then((response) => response.ok ? response.json() as Promise<DashboardResponse> : null)
      .then((data) => {
        if (active && data?.products?.length) {
          setProducts(data.products);
          if (data.metrics?.salesToday) setSalesToday(data.metrics.salesToday);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fa");
    if (!normalized) return products;
    return products.filter((product) => `${product.name} ${product.sku} ${product.brand}`.toLocaleLowerCase("fa").includes(normalized));
  }, [products, query]);

  const lowStock = products.filter((product) => product.stock <= product.reorderPoint).length;
  const totalStock = products.reduce((total, product) => total + product.stock, 0);

  function closeModal() {
    setModal(null);
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      sku: String(form.get("sku")),
      name: String(form.get("name")),
      unit: String(form.get("unit") || "عدد"),
      // Send exact digit strings so large Rial amounts never pass through float conversion.
      costPriceRial: String(form.get("costPriceRial") || "0").trim(),
      salePriceRial: String(form.get("salePriceRial") || "0").trim(),
      reorderPoint: Number(form.get("reorderPoint") || 0),
    };

    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      const product = await response.json();
      setProducts((current) => [{ ...product, brand: "بدون برند", category: "بدون دسته‌بندی", stock: 0 }, ...current]);
      setNotice("کالا با موفقیت ثبت شد.");
      closeModal();
    } catch {
      setNotice("ثبت کالا انجام نشد؛ اتصال پایگاه‌داده را بررسی کنید.");
    }
  }

  async function createReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId"));
    const quantity = Number(form.get("quantity"));
    const payload = {
      receiptNo: String(form.get("receiptNo")),
      lines: [{ productId, quantity, unitCostRial: String(form.get("unitCostRial") || "0").trim() }],
    };

    try {
      const response = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      setProducts((current) => current.map((product) => product.id === productId ? { ...product, stock: product.stock + quantity } : product));
      setNotice("رسید ورود کالا ثبت شد.");
      closeModal();
    } catch {
      setNotice("ثبت رسید انجام نشد؛ ابتدا پایگاه‌داده و کاربر مدیر را راه‌اندازی کنید.");
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">د</div>
          <div><strong>درودیان</strong><span>مدیریت هوشمند پخش</span></div>
        </div>
        <div>
          <div className="nav-label">منوی اصلی</div>
          <nav className="nav">
            <button className="nav-button active"><span className="nav-icon"><LayoutDashboard size={17} /></span><span>داشبورد</span></button>
            <button className="nav-button"><span className="nav-icon"><Boxes size={17} /></span><span>کالا و موجودی</span></button>
            <button className="nav-button"><span className="nav-icon"><ShoppingCart size={17} /></span><span>فروش و سفارش‌ها</span></button>
            <button className="nav-button"><span className="nav-icon"><Truck size={17} /></span><span>خرید و تأمین</span></button>
            <button className="nav-button"><span className="nav-icon"><Users size={17} /></span><span>مشتریان</span></button>
          </nav>
        </div>
        <div>
          <div className="nav-label">گزارش و تنظیمات</div>
          <nav className="nav">
            <button className="nav-button"><span className="nav-icon"><BarChart3 size={17} /></span><span>گزارش‌ها</span></button>
            <button className="nav-button"><span className="nav-icon"><Settings size={17} /></span><span>تنظیمات</span></button>
          </nav>
        </div>
        <div className="sidebar-foot">نسخه آزمایشی محصول<br />آخرین همگام‌سازی: امروز، ۱۰:۴۲</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">مدیریت پخش <ChevronLeft size={13} style={{ verticalAlign: "middle" }} /> <b>داشبورد</b></div>
          <div className="top-actions">
            <button className="icon-button" aria-label="جست‌وجو"><Search size={16} /></button>
            <button className="icon-button" aria-label="اعلان‌ها"><AlertTriangle size={16} /></button>
            <div className="user-chip"><div><b>مدیر سیستم</b><br /><span style={{ color: "var(--muted)", fontSize: 10 }}>مدیر فروش</span></div><div className="avatar">م</div></div>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><div className="eyebrow">شنبه، ۲۳ فروردین ۱۴۰۴</div><h1>صبح بخیر، مدیر سیستم</h1><p className="subtitle">وضعیت امروز کسب‌وکار را یک‌جا ببینید و سریع تصمیم بگیرید.</p></div>
            <button className="primary-button" onClick={() => setModal("receipt")}><Plus size={16} style={{ verticalAlign: "middle", marginLeft: 5 }} /> ثبت ورود کالا</button>
          </div>

          {notice && <div className="alert-strip" role="status"><AlertTriangle size={16} /><span>{notice}</span><button className="close-button" onClick={() => setNotice(null)} aria-label="بستن"><X size={15} /></button></div>}

          <section className="metric-grid" aria-label="خلاصه عملکرد">
            <MetricCard icon={<Boxes size={17} />} color="var(--teal-soft)" title="ارزش موجودی" value={formatMoney(products.reduce((sum, product) => sum + BigInt(product.stock) * BigInt(product.salePriceRial), 0n).toString())} note="بر اساس قیمت فروش" />
            <MetricCard icon={<ShoppingCart size={17} />} color="#e8eff8" title="فروش امروز" value={salesToday ? formatMoney(salesToday) : "۱۲۸ میلیون"} note={salesToday ? "مجموع فاکتورهای امروز" : "↑ ۱۸٪ نسبت به دیروز"} />
            <MetricCard icon={<PackagePlus size={17} />} color="var(--amber-soft)" title="کالاهای کم‌موجود" value={formatNumber(lowStock)} note="نیازمند بررسی" warning />
            <MetricCard icon={<ClipboardList size={17} />} color="#eee9f9" title="تعداد اقلام" value={formatNumber(totalStock)} note={`${formatNumber(products.length)} کالای فعال`} />
          </section>

          <div className="section-grid">
            <section className="panel">
              <div className="panel-header"><div><h2 className="panel-title">وضعیت موجودی کالا</h2><span className="panel-meta">آخرین وضعیت ثبت‌شده</span></div><button className="secondary-button" onClick={() => setModal("product")}><Plus size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} /> کالای جدید</button></div>
              <div style={{ padding: "14px 20px 0" }}><div className="field"><input aria-label="جست‌وجوی کالا" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو بر اساس نام کالا، کد یا برند..." /></div></div>
              <div className="table-wrap"><table><thead><tr><th>کالا</th><th>دسته‌بندی</th><th>موجودی</th><th>وضعیت</th><th>قیمت فروش</th></tr></thead><tbody>{filteredProducts.map((product) => { const status = stockStatus(product); return <tr key={product.id}><td><div className="product-cell"><div className="product-avatar">{product.brand.slice(0, 2)}</div><div><span className="product-name">{product.name}</span><span className="product-sku">{product.sku}</span></div></div></td><td>{product.category}</td><td><b>{formatNumber(product.stock)}</b> {product.unit}</td><td><span className={`status ${status.className}`}>{status.label}</span></td><td>{formatMoney(product.salePriceRial)}</td></tr>; })}</tbody></table></div>
            </section>

            <div style={{ display: "grid", gap: 18 }}>
              <section className="panel"><div className="panel-header"><div><h2 className="panel-title">دسترسی سریع</h2><span className="panel-meta">عملیات پرکاربرد</span></div></div><div className="quick-actions"><button className="quick-action" onClick={() => setModal("receipt")}><span className="quick-action-icon"><PackagePlus size={19} /></span><strong>ورود کالا</strong><span>ثبت رسید انبار</span></button><button className="quick-action" onClick={() => setModal("product")}><span className="quick-action-icon"><Plus size={19} /></span><strong>کالای جدید</strong><span>افزودن به فهرست کالا</span></button><button className="quick-action"><span className="quick-action-icon"><FileText size={19} /></span><strong>گزارش موجودی</strong><span>دریافت گزارش کامل</span></button><button className="quick-action"><span className="quick-action-icon"><ShoppingCart size={19} /></span><strong>ثبت فروش</strong><span>صدور فاکتور جدید</span></button></div></section>
              <section className="panel"><div className="panel-header"><div><h2 className="panel-title">فعالیت‌های اخیر</h2><span className="panel-meta">امروز</span></div><button className="secondary-button">مشاهده همه</button></div><div className="activity-list"><Activity text={<><b>رسید خرید #۴۸۲</b> از تأمین‌کننده آریا ثبت شد.</>} time="۱۰:۴۲" /><Activity text={<><b>فروش #۱۰۲۴</b> برای فروشگاه برق سمنان ثبت شد.</>} time="۱۰:۱۸" /><Activity text={<><b>موجودی کابل افشان ۲.۵</b> به حد سفارش رسید.</>} time="۰۹:۵۶" /></div></section>
            </div>
          </div>
          <div className="alert-strip"><AlertTriangle size={17} /><span><b>{formatNumber(lowStock)} کالا</b> به نقطه سفارش رسیده‌اند. پیشنهاد می‌شود موجودی آن‌ها را بررسی کنید.</span></div>
        </div>
      </main>

      {modal === "product" && <Modal title="افزودن کالای جدید" onClose={closeModal}><form className="form" onSubmit={createProduct}><div className="field"><label htmlFor="name">نام کالا</label><input id="name" name="name" required placeholder="مثلاً کنتاکتور اشنایدر LC1D25" /></div><div className="form-row"><div className="field"><label htmlFor="sku">کد کالا / SKU</label><input id="sku" name="sku" required placeholder="SCH-LC1D25" dir="ltr" /></div><div className="field"><label htmlFor="unit">واحد</label><input id="unit" name="unit" defaultValue="عدد" required /></div></div><div className="form-row"><div className="field"><label htmlFor="costPriceRial">قیمت خرید (ریال)</label><input id="costPriceRial" name="costPriceRial" type="number" min="0" defaultValue="0" required /></div><div className="field"><label htmlFor="salePriceRial">قیمت فروش (ریال)</label><input id="salePriceRial" name="salePriceRial" type="number" min="0" defaultValue="0" required /></div></div><div className="field"><label htmlFor="reorderPoint">نقطه سفارش</label><input id="reorderPoint" name="reorderPoint" type="number" min="0" defaultValue="0" required /></div><div className="form-actions"><button className="primary-button" type="submit">ثبت کالا</button><button className="secondary-button" type="button" onClick={closeModal}>انصراف</button></div></form></Modal>}
      {modal === "receipt" && <Modal title="ثبت ورود کالا" onClose={closeModal}><form className="form" onSubmit={createReceipt}><div className="form-row"><div className="field"><label htmlFor="receiptNo">شماره رسید</label><input id="receiptNo" name="receiptNo" required placeholder="REC-1404-001" dir="ltr" /></div><div className="field"><label htmlFor="productId">کالا</label><select id="productId" name="productId" required defaultValue=""><option value="" disabled>انتخاب کالا</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div></div><div className="form-row"><div className="field"><label htmlFor="quantity">تعداد</label><input id="quantity" name="quantity" type="number" min="1" required defaultValue="1" /></div><div className="field"><label htmlFor="unitCostRial">قیمت خرید (ریال)</label><input id="unitCostRial" name="unitCostRial" type="number" min="0" required defaultValue="0" /></div></div><div className="form-actions"><button className="primary-button" type="submit">ثبت رسید</button><button className="secondary-button" type="button" onClick={closeModal}>انصراف</button></div></form></Modal>}
    </div>
  );
}

function MetricCard({ icon, color, title, value, note, warning = false }: { icon: React.ReactNode; color: string; title: string; value: string; note: string; warning?: boolean }) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className="metric-icon" style={{ background: color }}>{icon}</span></div><div className="metric-value">{value}</div><div className={`metric-note ${warning ? "warning" : ""}`}>{note}</div></article>;
}

function Activity({ text, time }: { text: React.ReactNode; time: string }) {
  return <div className="activity"><span className="activity-dot" /><div className="activity-text">{text}</div><span className="activity-time">{time}</span></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="close-button" onClick={onClose} aria-label="بستن"><X size={19} /></button></div>{children}</section></div>;
}
