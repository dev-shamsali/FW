# Deploying the website to rhea.devcodehub.cloud

The website and docs are one static bundle: `apps/website/out/`. Any static host works. These steps use your own server with nginx.

Checked on 2026-10-07: DNS for `rhea.devcodehub.cloud` already resolves to `72.61.242.86`. Make sure that is your server.

## 1. Build

```bash
npm ci
npm run build           # packages (the docs examples need them)
npm run build:website   # docs + website -> apps/website/out
```

The site URL comes from `site.config.json` (`siteUrl`). Change it there if the domain ever changes, then rebuild. After you create the GitHub repository, run `npm run set-repo -- <owner>/<repo>` first so the site shows the GitHub link.

## 2. Upload

```bash
rsync -av --delete apps/website/out/ user@72.61.242.86:/var/www/rhea/
```

## 3. Server (once)

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo mkdir -p /var/www/rhea && sudo chown $USER /var/www/rhea
sudo cp deploy/nginx.conf /etc/nginx/sites-available/rhea
sudo ln -s /etc/nginx/sites-available/rhea /etc/nginx/sites-enabled/rhea
```

The config references certificate files that do not exist yet. Get a certificate first with a temporary HTTP-only server block, or run:

```bash
sudo certbot certonly --nginx -d rhea.devcodehub.cloud   # if nginx refuses to start, comment out the 443 block, run certbot, then restore it
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Check

```bash
curl -I https://rhea.devcodehub.cloud/                 # 200, security headers present
curl -I https://rhea.devcodehub.cloud/docs/introduction/
curl https://rhea.devcodehub.cloud/sitemap.xml
```

Then open the site in a browser and check the console for Content-Security-Policy errors.

## 5. Search engines

Submit `https://rhea.devcodehub.cloud/sitemap.xml` in Google Search Console and Bing Webmaster Tools. That needs your own account, so it is a manual step.
