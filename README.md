# سامانه مدیریت هوشمند پرسنل | Intelligent Personnel Management System

این پروژه یک سامانه جامع برای مدیریت، تحلیل و گزارش‌گیری داده‌های پرسنلی بر اساس فایل‌های اکسل است. این نسخه برای پایداری بالا و امنیت در سرورهای لینوکس (مخصوصاً سرورهای داخل ایران) بهینه شده است.

---

## 🚀 راهنمای راه‌اندازی سریع (اتوماتیک)
اگر می‌خواهید تمام مراحل زیر (نصب Node.js، Nginx، تنظیم آینه‌ها، کلون پروژه و اجرا) به صورت خودکار انجام شود، دستور زیر را در ترمینال سرور اوبونتو اجرا کنید:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/mohamadkazemt/-/main/install.sh)"
```

---

## 🛠️ راهنمای گام‌به‌گام نصب دستی (Manual Deployment)

این راهنما برای سرورهای **Ubuntu 20.04/22.04** تدوین شده است.

### مرحله ۱: آپدیت سیستم و نصب ابزارهای پایه
ابتدا پکیج‌های سیستم را بروزرسانی کرده و ابزارهای مورد نیاز را نصب کنید:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

### مرحله ۲: نصب Node.js و تنظیم آینه (Mirror) ایران
به دلیل محدودیت‌های دسترسی در سرورهای ایران، پیشنهاد می‌شود از آینه **ArvanCloud** برای سرعت بیشتر استفاده کنید:

```bash
# نصب Node.js نسخه 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# تنظیم آینه رسمی ایران برای NPM
npm config set registry https://npm.arvancloud.ir
```

### مرحله ۳: آماده‌سازی پروژه
ابتدا پوشه مقصد را بسازید و دسترسی آن را برای کاربر خودتان آزاد کنید:

```bash
# ایجاد پوشه و تغییر مالکیت به کاربر جاری
sudo mkdir -p /var/www/personnel-app
sudo chown $USER:$USER /var/www/personnel-app

# حالا کلون کردن بدون خطا انجام می‌شود
git clone https://github.com/mohamadkazemt/-.git /var/www/personnel-app
cd /var/www/personnel-app

# نصب پکیج‌ها (با استفاده از آینه تنظیم شده)
npm install

# ساخت نسخه پروداکشن (فرانت‌اند)
npm run build
```

### مرحله ۴: تنظیمات فایل .env
فایل تنظیمات را ایجاد و مقادیر مورد نیاز (بخصوص رمز مدیریت و کلید امنیتی) را ست کنید:

```bash
nano .env
```
محتوای زیر را در آن قرار دهید:
```env
JWT_SECRET=یک_عبارت_تصادفی_و_طولانی
ADMIN_USER=ایمیل_مدیر
ADMIN_PASSWORD=رمز_عبور_مدیر
NODE_ENV=production
```

### مرحله ۵: پیکربندی Nginx (Reverse Proxy)
برای اتصال دامنه به برنامه و مدیریت ترافیک، یک فایل کانفیگ برای Nginx بسازید:

```bash
sudo nano /etc/nginx/sites-available/personnel-app
```
محتوای زیر را قرار دهید (بجای `example.com` دامنه یا IP خود را بگذارید):
```nginx
server {
    listen 80;
    server_name example.com; # یا آی‌پی سرور

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M; # برای آپلود راحت فایل‌های اکسل سنگین
    }
}
```
سپس فایل را فعال و Nginx را ریستارت کنید:
```bash
sudo ln -s /etc/nginx/sites-available/personnel-app /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### مرحله ۶: دریافت گواهینامه SSL (HTTPS)
اگر دامنه دارید، حتماً از پروتکل امن HTTPS استفاده کنید:

```bash
sudo certbot --nginx -d example.com
```

### مرحله ۷: مدیریت پردازش با PM2
برای اینکه برنامه در پس‌زمینه اجرا شود و در صورت کراش یا ریستارت سرور خودکار بالا بیاید:

```bash
sudo npm install -g pm2
pm2 start npm --name "personnel-app" -- run start
pm2 save
pm2 startup
```

---

## 📊 نگهداری و عیب‌یابی (Maintenance)

- **مشاهده لاگ‌های زنده:** `pm2 logs personnel-app`
- **بروزرسانی پروژه:**
  ```bash
  cd /var/www/personnel-app
  git pull
  npm install
  npm run build
  pm2 restart personnel-app
  ```
- **بررسی وضعیت Nginx:** `sudo systemctl status nginx`

---

## 🇮🇷 نکات ویژه سرورهای ایران
- اگر در دریافت پکیج‌های سیستم (`apt update`) مشکل داشتید، از آینه‌های ایرانی اوبونتو در `/etc/apt/sources.list` استفاده کنید.
- تنظیم `npm config set registry https://npm.arvancloud.ir` تضمین می‌کند که نصب وابستگی‌ها با سرعت بالا و بدون تحریم انجام شود.

---

## 🇬🇧 Developer Notes
- **Frontend:** React 18, Tailwind CSS, Lucide Icons, Recharts.
- **Backend:** Express (Node.js), SQLite (Local Storage).
- **Features:** Excel Export/Import, Advanced Filtering, Personnel Analytics Dashboard.
