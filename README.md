# سامانه مدیریت هوشمند پرسنل | Intelligent Personnel Management System

این پروژه یک سامانه تحت وب برای مدیریت و تحلیل داده‌های پرسنلی بر اساس فایل‌های اکسل است.
This project is a web-based system for managing and analyzing personnel data based on Excel files.

---

## 🛠️ تنظیمات اولیه سیستم (MySQL)

برای استفاده از دیتابیس MySQL، مراحل زیر را انجام دهید:

1. **ایجاد دیتابیس:**
   - اسکریپت موجود در فایل `db.sql` را در محیط MySQL خود اجرا کنید تا جداول مورد نیاز ساخته شوند.

2. **تنظیمات محیطی (Environment Variables):**
   - فایل `.env.example` را به `.env` تغییر نام دهید و مقادیر زیر را تنظیم کنید:
     - اطلاعات اتصال به MySQL (`MYSQL_HOST`, `MYSQL_USER`, etc.)
     - رمز عبور مدیر سامانه (`ADMIN_USER`, `ADMIN_PASSWORD`)
     - یک کلید امنیتی برای JWT (`JWT_SECRET`)

3. **ایجاد کاربر مدیر:**
   - اولین ورود شما با اطلاعاتی که در فایل `.env` تعریف کرده‌اید انجام خواهد شد. سیستم به صورت خودکار از این اطلاعات برای ورود اولیه استفاده می‌کند.

---

## 🚀 شروع سریع | Quick Start (One-Liner)

اگر می‌خواهید همه مراحل نصب (Node.js, Git, PM2) و راه‌اندازی پروژه به صورت خودکار روی سرور اوبونتو انجام شود، دستور زیر را در ترمینال اجرا کنید:
To install everything automatically on an Ubuntu server, run the following command:

```bash
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/mohamadkazemt/-/main/install.sh)"
```
> **نکته:** حتماً قبل از اجرا، آدرس مخزن گیت‌هاب خود را در دستور بالا جایگزین کنید.
> **Note:** Replace the GitHub URL with your actual repository URL before running.

---

## 🇮🇷 راهنمای نصب دستی (ubuntu server)

### ۱. پیش‌نیازها
ابتدا باید Node.js و npm را روی سرور خود نصب کنید.

```bash
# آپدیت سیستم
sudo apt update && sudo apt upgrade -y

# نصب Node.js (نسخه پیشنهادی ۲۰ یا بالاتر)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### ۲. نصب پروژه
فایل‌های پروژه را به سرور منتقل کرده و وارد پوشه پروژه شوید:

```bash
# نصب بسته‌های مورد نیاز
npm install

# ساخت نسخه نهایی (Production Build)
npm run build
```

### ۳. اجرا با استفاده از PM2 (برای پایداری)
برای اینکه برنامه بعد از بستن ترمینال هم فعال بماند، از PM2 استفاده می‌کنیم:

```bash
sudo npm install -g pm2
# اجرا روی پورت ۳۰۰۰ (یا هر پورت دلخواه در فایل .env)
pm2 start npm --name "personnel-app" -- run start
```

---

## 🇬🇧 Deployment Guide (Ubuntu Server)

### 1. Prerequisites
You need to install Node.js and npm on your server.

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20+ recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Project Installation
Transfer project files to the server and navigate to the project directory:

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Run with PM2 (For Stability)
To keep the application running in the background, use PM2:

```bash
sudo npm install -g pm2
# Run the production server
pm2 start npm --name "personnel-app" -- run start
```

---

## 🚀 اسکریپت نصب خودکار / Auto-Install Script
اگر می‌خواهید همه مراحل بالا به صورت خودکار انجام شود، از فایل `deploy.sh` استفاده کنید:

```bash
chmod +x deploy.sh
./deploy.sh
```
