"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { LockKeyhole } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    if (result?.error) setError("ایمیل یا رمز عبور صحیح نیست.");
    else window.location.href = "/";
    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark login-mark">ت</div>
        <div className="eyebrow">مدیریت هوشمند پخش</div>
        <h1>ورود به پنل TradeFlow</h1>
        <p className="subtitle">برای ادامه، اطلاعات حساب کاربری خود را وارد کنید.</p>
        <form className="form" onSubmit={submit}>
          <div className="field"><label htmlFor="email">ایمیل</label><input id="email" name="email" type="email" required dir="ltr" autoComplete="username" placeholder="manager@droodi.local" /></div>
          <div className="field"><label htmlFor="password">رمز عبور</label><input id="password" name="password" type="password" required dir="ltr" autoComplete="current-password" placeholder="رمز عبور خود را وارد کنید" /></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button login-button" disabled={loading} type="submit"><LockKeyhole size={16} /> {loading ? "در حال ورود..." : "ورود به سیستم"}</button>
        </form>
        <p className="login-help">حساب اولیه از طریق seed محیط توسعه ساخته می‌شود.</p>
      </section>
    </main>
  );
}
