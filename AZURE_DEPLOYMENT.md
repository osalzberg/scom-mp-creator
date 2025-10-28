# Azure Static Web App Deployment Instructions

## Prerequisites
- Azure account with an active subscription
- GitHub repository with your code (already done!)

## Option 1: Deploy via Azure Portal (Easiest)

1. **Go to Azure Portal**: https://portal.azure.com

2. **Create a Static Web App**:
   - Click "Create a resource"
   - Search for "Static Web App"
   - Click "Create"

3. **Configure the basics**:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `scom-mp-creator` (or your preferred name)
   - **Plan type**: Free (for testing) or Standard
   - **Region**: Choose closest to you
   - **Source**: GitHub
   - Click "Sign in with GitHub" if needed

4. **Configure deployment**:
   - **Organization**: osalzberg
   - **Repository**: scom-mp-creator
   - **Branch**: main
   - **Build Presets**: Custom
   - **App location**: `/`
   - **Api location**: (leave empty)
   - **Output location**: `/`

5. **Review + Create**:
   - Click "Review + create"
   - Click "Create"

6. **Wait for deployment**:
   - Azure will automatically create a GitHub Actions workflow
   - Check the Actions tab in your GitHub repo to see deployment progress
   - Once complete, you'll get a URL like: `https://[your-app-name].azurestaticapps.net`

## Option 2: Deploy via Azure CLI

```bash
# Login to Azure
az login

# Create a resource group (if needed)
az group create --name rg-scom-mp-creator --location eastus

# Create the static web app
az staticwebapp create \
  --name scom-mp-creator \
  --resource-group rg-scom-mp-creator \
  --source https://github.com/osalzberg/scom-mp-creator \
  --location eastus \
  --branch main \
  --app-location "/" \
  --output-location "/" \
  --login-with-github
```

## What happens next?

1. Azure creates a GitHub secret called `AZURE_STATIC_WEB_APPS_API_TOKEN` in your repo
2. Every push to `main` branch triggers automatic deployment
3. Your app will be live at the URL provided by Azure
4. Changes pushed to GitHub are automatically deployed

## Custom Domain (Optional)

To use your own domain:
1. In Azure Portal, go to your Static Web App
2. Click "Custom domains"
3. Add your domain and follow DNS configuration steps

## Notes

- The free tier includes:
  - 100 GB bandwidth per month
  - 0.5 GB storage
  - Custom domains with free SSL
  - Perfect for this project!

- All your JavaScript, HTML, and CSS files will be served as static content
- No server-side code needed - pure client-side app!
