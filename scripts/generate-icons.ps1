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

function Draw-Logo($G, [float]$X, [float]$Y, [float]$S) {
  $Rect = New-Object System.Drawing.Rectangle ([int]$X), ([int]$Y), ([int]$S), ([int]$S)
  $Bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $Rect, `
    ([System.Drawing.Color]::FromArgb(219, 234, 254)), `
    ([System.Drawing.Color]::FromArgb(243, 232, 255)), 45

  $Indigo = [System.Drawing.Color]::FromArgb(37, 99, 235)
  $Violet = [System.Drawing.Color]::FromArgb(124, 58, 237)
  $IndigoDark = [System.Drawing.Color]::FromArgb(29, 78, 216)

  $BlueBrush = New-Object System.Drawing.SolidBrush $Indigo
  $VioletBrush = New-Object System.Drawing.SolidBrush $Violet
  $WhiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255))
  $DarkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
  $Shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 15, 23, 42))
  $OutlinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 255, 255)), ([Math]::Max(1.0, $S * 0.02))

  Fill-Round $G $Bg $X $Y $S $S ([Math]::Max(4, $S * 0.22))

  $CardX = $X + $S * 0.13
  $CardY = $Y + $S * 0.17
  $CardW = $S * 0.74
  $CardH = $S * 0.66
  $CR = [Math]::Max(2, $S * 0.13)

  Fill-Round $G $Shadow ($CardX + $S * 0.012) ($CardY + $S * 0.018) $CardW $CardH $CR
  Fill-Round $G $WhiteBrush $CardX $CardY $CardW $CardH $CR

  $CardRect = New-Object System.Drawing.RectangleF ($CardX), ($CardY), ($CardW), ($CardH)
  $InnerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(226, 232, 240)), ([Math]::Max(1, $S * 0.012))
  $CardPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundPath $CardPath $CardX $CardY $CardW $CardH $CR
  $G.DrawPath($InnerPen, $CardPath)
  $CardPath.Dispose()

  $Format = New-Object System.Drawing.StringFormat
  $Format.Alignment = [System.Drawing.StringAlignment]::Near
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $Font = New-Object System.Drawing.Font 'Cascadia Code', ([float]($S * 0.28)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  if ($Font.Name -ne 'Cascadia Code') {
    $Font.Dispose()
    $Font = New-Object System.Drawing.Font 'Consolas', ([float]($S * 0.28)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  }

  $TextRect = New-Object System.Drawing.RectangleF ($CardX + $S * 0.09), ($CardY + $S * 0.13), ($CardW - $S * 0.18), ($CardH - $S * 0.24)
  $G.DrawString('{ }', $Font, $VioletBrush, $TextRect, $Format)

  $LineY = $CardY + $CardH * 0.62
  $LineX1 = $CardX + $S * 0.10
  $LineX2 = $CardX + $CardW - $S * 0.28
  $LinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(203, 213, 225)), ([Math]::Max(1.2, $S * 0.012))
  $G.DrawLine($LinePen, (New-Object System.Drawing.PointF ($LineX1), ($LineY)), (New-Object System.Drawing.PointF ($LineX2), ($LineY)))

  $LineY2 = $CardY + $CardH * 0.78
  $LineX2b = $CardX + $CardW - $S * 0.40
  $G.DrawLine($LinePen, (New-Object System.Drawing.PointF ($LineX1), ($LineY2)), (New-Object System.Drawing.PointF ($LineX2b), ($LineY2)))

  $BadgeX = $X + $S * 0.59
  $BadgeY = $Y + $S * 0.08
  $BadgeW = $S * 0.30
  $BadgeH = $S * 0.20
  Fill-Round $G $Shadow ($BadgeX + 1.5) ($BadgeY + 1.8) $BadgeW $BadgeH ([Math]::Max(2, $S * 0.18))
  Fill-Round $G $BlueBrush $BadgeX $BadgeY $BadgeW $BadgeH ([Math]::Max(2, $S * 0.18))

  $BadgeFont = New-Object System.Drawing.Font 'Segoe UI', ([float]($S * 0.11)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $BadgeFormat = New-Object System.Drawing.StringFormat
  $BadgeFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $BadgeFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
  $G.DrawString('JSON', $BadgeFont, $WhiteBrush, `
    (New-Object System.Drawing.RectangleF ($BadgeX), ($BadgeY), ($BadgeW), ($BadgeH)), $BadgeFormat)

  $Bg.Dispose(); $BlueBrush.Dispose(); $VioletBrush.Dispose(); $WhiteBrush.Dispose()
  if ($DarkBrush) { $DarkBrush.Dispose() }
  if ($Shadow) { $Shadow.Dispose() }
  if ($OutlinePen) { $OutlinePen.Dispose() }
  if ($Format) { $Format.Dispose() }
  if ($Font) { $Font.Dispose() }
  if ($InnerPen) { $InnerPen.Dispose() }
  if ($LinePen) { $LinePen.Dispose() }
  if ($BadgeFont) { $BadgeFont.Dispose() }
  if ($BadgeFormat) { $BadgeFormat.Dispose() }
}

function New-Icon([int]$Size, [string]$Path) {
  $Bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  Draw-Logo $Graphics 0 0 $Size
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Graphics.Dispose(); $Bitmap.Dispose()
}

foreach ($Size in @(16, 32, 48, 128)) {
  New-Icon $Size (Join-Path $AssetDir "icon-$Size.png")
}

New-Icon 300 (Join-Path $StoreDir 'logo-300.png')

Get-Item (Join-Path $AssetDir 'icon-16.png'), `
  (Join-Path $AssetDir 'icon-32.png'), `
  (Join-Path $AssetDir 'icon-48.png'), `
  (Join-Path $AssetDir 'icon-128.png'), `
  (Join-Path $StoreDir 'logo-300.png') |
  Select-Object FullName, Length
