Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent $PSScriptRoot
$AssetDir = Join-Path $Root 'assets'
$StoreDir = Join-Path $Root 'store-assets'
if (-not (Test-Path -LiteralPath $StoreDir)) {
  New-Item -ItemType Directory -Path $StoreDir | Out-Null
}

function Add-RoundPath($Path, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
  $D = $R * 2
  $Path.AddArc($X, $Y, $D, $D, 180, 90)
  $Path.AddArc($X + $W - $D, $Y, $D, $D, 270, 90)
  $Path.AddArc($X + $W - $D, $Y + $H - $D, $D, $D, 0, 90)
  $Path.AddArc($X, $Y + $H - $D, $D, $D, 90, 90)
  $Path.CloseFigure()
}

function Fill-Round($G, $Brush, [float]$X, [float]$Y, [float]$W, [float]$H, [float]$R) {
  $Path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundPath $Path $X $Y $W $H $R
  $G.FillPath($Brush, $Path)
  $Path.Dispose()
}

function New-Bitmap([int]$W, [int]$H) {
  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Bitmap($Pair, [string]$Path) {
  $Pair.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Pair.Graphics.Dispose()
  $Pair.Bitmap.Dispose()
}

function Draw-GradientBg($G, [int]$W, [int]$H, [System.Drawing.Color]$C1, [System.Drawing.Color]$C2, [float]$Angle) {
  $Rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
  $Brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $Rect, $C1, $C2, $Angle
  $G.FillRectangle($Brush, $Rect)
  $Brush.Dispose()
}

function New-Screenshot($Path, [string]$Title, [string]$Subtitle, [string]$JsonText, [string]$ViewMode) {
  $W = 1280
  $H = 800
  $Pair = New-Bitmap $W $H
  $G = $Pair.Graphics

  Draw-GradientBg $G $W $H `
    ([System.Drawing.Color]::FromArgb(255, 241, 245, 244)) `
    ([System.Drawing.Color]::FromArgb(255, 224, 240, 235)) 45

  $ChromeY = 40
  $ChromeH = 52
  $WindowX = 80
  $WindowY = 110
  $WindowW = $W - 160
  $WindowH = $H - 180

  $ChromeBar = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    (New-Object System.Drawing.Rectangle $WindowX, $WindowY, $WindowW, $ChromeH), `
    ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), `
    ([System.Drawing.Color]::FromArgb(255, 248, 250, 249)), 90
  $G.FillRectangle($ChromeBar, $WindowX, $WindowY, $WindowW, $ChromeH)
  $ChromeBar.Dispose()

  $Dots = @(
    @{ X = $WindowX + 22; C = [System.Drawing.Color]::FromArgb(255, 188, 205, 202) },
    @{ X = $WindowX + 44; C = [System.Drawing.Color]::FromArgb(255, 154, 191, 182) },
    @{ X = $WindowX + 66; C = [System.Drawing.Color]::FromArgb(255, 8, 123, 104) }
  )
  foreach ($D in $Dots) {
    $G.FillEllipse((New-Object System.Drawing.SolidBrush $D.C), $D.X, ($WindowY + 18), 16, 16)
  }

  $TitleFont = New-Object System.Drawing.Font 'Segoe UI', 18, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $TitleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 48, 51))
  $G.DrawString($Title, $TitleFont, $TitleBrush, ($WindowX + 100), ($WindowY + 14))

  $ContentY = $WindowY + $ChromeH
  $ContentH = $WindowH - $ChromeH
  $ContentBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 241, 245, 244))
  $G.FillRectangle($ContentBg, $WindowX, $ContentY, $WindowW, $ContentH)

  $HeaderH = 70
  $HeaderBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush `
    (New-Object System.Drawing.Rectangle $WindowX, $ContentY, $WindowW, $HeaderH), `
    ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)), `
    ([System.Drawing.Color]::FromArgb(255, 248, 250, 249)), 0
  $G.FillRectangle($HeaderBg, $WindowX, $ContentY, $WindowW, $HeaderH)

  $BannerTitleFont = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $BannerSubFont = New-Object System.Drawing.Font 'Segoe UI', 13, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $DarkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 48, 51))
  $MutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 113, 128, 131))
  $G.DrawString('JSON Beautify', $BannerTitleFont, $DarkBrush, ($WindowX + 26), ($ContentY + 12))
  $G.DrawString($Subtitle, $BannerSubFont, $MutedBrush, ($WindowX + 26), ($ContentY + 44))

  $CodeY = $ContentY + $HeaderH + 22
  $CodeX = $WindowX + 26
  $CodeW = $WindowW - 52
  $CodeH = $ContentH - $HeaderH - 44

  $CodeBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 251, 252, 252))
  Fill-Round $G $CodeBg $CodeX $CodeY $CodeW $CodeH 14

  $CodeFont = New-Object System.Drawing.Font 'Consolas', 15, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $KeyBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 163, 60, 116))
  $StrBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 154, 98, 16))
  $NumBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 23, 110, 174))
  $BoolBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 29, 123, 92))
  $NullBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 174, 74, 74))
  $PuncBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 38, 53, 56))

  $Lines = $JsonText -split "`n"
  $LineY = $CodeY + 22
  $LineH = 26
  $LineNo = 1
  foreach ($RawLine in $Lines) {
    $Line = $RawLine -replace "`r$", ''
    $G.DrawString($LineNo.ToString('00'), $CodeFont, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 141, 155, 156))), ($CodeX + 16), $LineY)

    $LineX = $CodeX + 66
    $chars = $Line.ToCharArray()
    $i = 0
    while ($i -lt $chars.Length) {
      $c = $chars[$i]
      if ($c -eq '"') {
        $start = $i
        $buf = '"'
        $i += 1
        while ($i -lt $chars.Length) {
          $ch = $chars[$i]
          $buf += $ch
          if ($ch -eq '\' -and ($i + 1) -lt $chars.Length) {
            $buf += $chars[$i + 1]
            $i += 2
            continue
          }
          if ($ch -eq '"') { $i += 1; break }
          $i += 1
        }
        $peek = ''
        for ($j = $i; $j -lt $chars.Length; $j += 1) {
          if (-not [char]::IsWhiteSpace($chars[$j])) { $peek = $chars[$j]; break }
        }
        $brush = if ($peek -eq ':') { $KeyBrush } else { $StrBrush }
        $G.DrawString($buf, $CodeFont, $brush, $LineX, $LineY)
        $sz = $G.MeasureString($buf, $CodeFont)
        $LineX += $sz.Width - 4
      } elseif ($c -eq '{' -or $c -eq '}' -or $c -eq '[' -or $c -eq ']' -or $c -eq ':' -or $c -eq ',') {
        $G.DrawString($c.ToString(), $CodeFont, $PuncBrush, $LineX, $LineY)
        $sz = $G.MeasureString($c.ToString(), $CodeFont)
        $LineX += $sz.Width - 4
        $i += 1
      } elseif ([char]::IsDigit($c) -or $c -eq '-') {
        $buf = ''
        while ($i -lt $chars.Length -and ('0123456789+-.eE'.Contains($chars[$i]))) {
          $buf += $chars[$i]; $i += 1
        }
        $G.DrawString($buf, $CodeFont, $NumBrush, $LineX, $LineY)
        $sz = $G.MeasureString($buf, $CodeFont)
        $LineX += $sz.Width - 4
      } elseif ([char]::IsLetter($c)) {
        $buf = ''
        while ($i -lt $chars.Length -and [char]::IsLetterOrDigit($chars[$i])) {
          $buf += $chars[$i]; $i += 1
        }
        $brush = if ($buf -eq 'true' -or $buf -eq 'false') { $BoolBrush } elseif ($buf -eq 'null') { $NullBrush } else { $PuncBrush }
        $G.DrawString($buf, $CodeFont, $brush, $LineX, $LineY)
        $sz = $G.MeasureString($buf, $CodeFont)
        $LineX += $sz.Width - 4
      } else {
        $G.DrawString($c.ToString(), $CodeFont, $PuncBrush, $LineX, $LineY)
        $sz = $G.MeasureString($c.ToString(), $CodeFont)
        $LineX += $sz.Width - 4
        $i += 1
      }
    }
    $LineY += $LineH
    $LineNo += 1
    if ($LineY -gt ($CodeY + $CodeH - 40)) { break }
  }

  Save-Bitmap $Pair $Path
}

$Json1 = @'
{
  "product": "JSON Beautify",
  "version": "1.0.0",
  "features": [
    "format",
    "minify",
    "validate",
    "line-numbers",
    "folding"
  ],
  "enabled": true,
  "stats": {
    "lines": 128,
    "bytes": 4096,
    "keys": 6
  },
  "lastError": null
}
'@

$Json2 = @'
{
  "id": 1024,
  "username": "jane_doe",
  "email": "jane@example.com",
  "profile": {
    "displayName": "Jane Doe",
    "avatar": "https://cdn.example.com/avatar.png",
    "bio": "Developer. Writer. Dreamer.",
    "settings": {
      "theme": "dark",
      "language": "zh-CN",
      "notifications": true
    }
  },
  "roles": ["admin", "editor", "viewer"],
  "joinedAt": "2024-01-15T08:42:11Z",
  "verified": true
}
'@

$Json3 = @'
[
  {
    "timestamp": 1710000000,
    "level": "INFO",
    "message": "User login",
    "userId": "u_01H",
    "metadata": { "ip": "10.0.0.2", "ua": "Edge/124" }
  },
  {
    "timestamp": 1710000042,
    "level": "WARN",
    "message": "Rate limit near",
    "metadata": { "remaining": 12 }
  },
  {
    "timestamp": 1710000111,
    "level": "ERROR",
    "message": "Connection timeout",
    "stack": "at ApiClient.fetch (client.js:42:15)",
    "retry": true
  }
]
'@

New-Screenshot (Join-Path $StoreDir 'screenshot-1-editor-1280x800.png') `
  'panel.html - Editor' 'Format, minify, validate, inspect stats, copy and export JSON' $Json1 'editor'

New-Screenshot (Join-Path $StoreDir 'screenshot-2-compare-1280x800.png') `
  'panel.html - Compare' 'Compare two JSON documents and inspect the first difference' $Json2 'compare'

New-Screenshot (Join-Path $StoreDir 'screenshot-3-auto-1280x800.png') `
  'content.js - Auto Format' 'Auto-formats raw JSON pages: highlight, toggle raw/pretty, download' $Json3 'raw'

$LargePair = New-Bitmap 1400 560
$LG = $LargePair.Graphics
Draw-GradientBg $LG 1400 560 `
  ([System.Drawing.Color]::FromArgb(255, 241, 245, 244)) `
  ([System.Drawing.Color]::FromArgb(255, 216, 236, 229)) 135

$TitleFont = New-Object System.Drawing.Font 'Segoe UI', 64, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$SubFont = New-Object System.Drawing.Font 'Segoe UI', 24, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$PromoTitleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 37, 48, 51))
$SubBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 81, 103, 104))
$LG.DrawString('JSON Beautify', $TitleFont, $PromoTitleBrush, 80, 130)
$LG.DrawString('Format · Minify · Compare · Escape', $SubFont, $SubBrush, 82, 220)
$LG.DrawString('Edge extension · Local processing · Zero data uploads', $SubFont, $SubBrush, 82, 264)

$SampleBoxX = 820
$SampleBoxY = 100
$SampleBoxW = 520
$SampleBoxH = 380
$SBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
Fill-Round $LG $SBg $SampleBoxX $SampleBoxY $SampleBoxW $SampleBoxH 20
$SCodeFont = New-Object System.Drawing.Font 'Consolas', 20, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$Sample = '{ "name": "JSON Beautify", "ok": true, "tags": ["format", "minify"] }'
$Lines = @(
  '{',
  '  "name": "JSON Beautify",',
  '  "ok": true,',
  '  "tags": [',
  '    "format",',
  '    "minify"',
  '  ]',
  '}'
)
$sy = $SampleBoxY + 44
foreach ($line in $Lines) {
  $LG.DrawString($line, $SCodeFont, $SubBrush, ($SampleBoxX + 32), $sy)
  $sy += 40
}

Save-Bitmap $LargePair (Join-Path $StoreDir 'large-promo-1400x560.png')

$SmallPair = New-Bitmap 440 280
$SG = $SmallPair.Graphics
Draw-GradientBg $SG 440 280 `
  ([System.Drawing.Color]::FromArgb(255, 255, 255, 255)) `
  ([System.Drawing.Color]::FromArgb(255, 224, 240, 235)) 135

$STitleFont = New-Object System.Drawing.Font 'Segoe UI', 34, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$SSubFont = New-Object System.Drawing.Font 'Segoe UI', 13, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$SG.DrawString('JSON Beautify', $STitleFont, $PromoTitleBrush, 24, 86)
$SG.DrawString('Format, Beautify, Minify & Validate JSON', $SSubFont, $SubBrush, 26, 138)
$SG.DrawString('Compare + folding + auto-format JSON pages', $SSubFont, $SubBrush, 26, 160)

Save-Bitmap $SmallPair (Join-Path $StoreDir 'small-promo-440x280.png')

$TitleFont.Dispose(); $SubFont.Dispose(); $PromoTitleBrush.Dispose(); $SubBrush.Dispose()

Get-ChildItem -LiteralPath $StoreDir -File |
  Where-Object { $_.Extension -eq '.png' } |
  Sort-Object Name |
  Select-Object Name, @{N = 'KB'; E = { [math]::Round($_.Length / 1KB, 1) } } |
  Format-Table -AutoSize
