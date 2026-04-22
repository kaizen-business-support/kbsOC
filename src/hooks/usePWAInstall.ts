import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function buildWindowsBat(appUrl: string): string {
  return `@echo off
setlocal enabledelayedexpansion
set "APP_NAME=OptimusCredit"
set "APP_URL=${appUrl}"
set "DESKTOP=%USERPROFILE%\\Desktop"

echo Installation de OptimusCredit en cours...
echo.

:: Recherche de Edge puis Chrome
set "BROWSER="
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (
    set "BROWSER=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
) else if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"
) else if exist "%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe" (
    set "BROWSER=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"
)

if "!BROWSER!"=="" (
    echo [ERREUR] Chrome ou Microsoft Edge n'est pas installe.
    echo Installez Chrome ou Edge puis relancez ce script.
    pause
    exit /b 1
)

:: Creation du raccourci Bureau via PowerShell
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\\%APP_NAME%.lnk'); $s.TargetPath = '!BROWSER!'; $s.Arguments = '--app=%APP_URL% --window-size=1440,900'; $s.Description = 'OptimusCredit - Plateforme de Credit Bancaire'; $s.Save()"

if !errorlevel! equ 0 (
    echo.
    echo [OK] OptimusCredit installe avec succes !
    echo Un raccourci a ete cree sur votre Bureau.
    echo Double-cliquez dessus pour lancer l'application.
) else (
    echo [ERREUR] L'installation a echoue. Verifiez vos droits.
)
echo.
pause
`;
}

function buildMacScript(appUrl: string): string {
  return `#!/bin/bash
APP_NAME="OptimusCredit"
APP_URL="${appUrl}"
APP_DIR="/Applications/OptimusCredit.app"

echo "Installation de OptimusCredit..."

# Chercher Chrome ou Edge
CHROME=""
if [ -d "/Applications/Google Chrome.app" ]; then
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  CHROME="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
fi

if [ -n "$CHROME" ]; then
  mkdir -p "$APP_DIR/Contents/MacOS"
  printf '#!/bin/bash\\nopen -na "%s" --args --app=%s --window-size=1440,900\\n' "$CHROME" "$APP_URL" > "$APP_DIR/Contents/MacOS/OptimusCredit"
  chmod +x "$APP_DIR/Contents/MacOS/OptimusCredit"
  printf '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>OptimusCredit</string><key>CFBundleName</key><string>OptimusCredit</string><key>CFBundleIdentifier</key><string>sn.optimuscredit.app</string><key>CFBundleVersion</key><string>1.0</string></dict></plist>' > "$APP_DIR/Contents/Info.plist"
  echo "[OK] OptimusCredit installe ! Ouvrez Applications > OptimusCredit"
else
  osascript -e "tell app \\"Finder\\" to make internet location file at desktop to \\"$APP_URL\\" with properties {name:\\"$APP_NAME\\"}"
  echo "[OK] Raccourci cree sur le Bureau."
fi
`;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installViaPWA = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
    return outcome === 'accepted';
  };

  const downloadWindowsInstaller = () => {
    const appUrl = window.location.origin;
    const content = buildWindowsBat(appUrl);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Installer-OptimusCredit.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMacInstaller = () => {
    const appUrl = window.location.origin;
    const content = buildMacScript(appUrl);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Installer-OptimusCredit.command';
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    installViaPWA,
    downloadWindowsInstaller,
    downloadMacInstaller,
  };
}
