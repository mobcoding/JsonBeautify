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
    ([System.Drawing.Color]::FromArgb(247, 253, 251)), `
    ([System.Drawing.Color]::FromArgb(205, 239, 231)), 55

  $Teal = [System.Drawing.Color]::FromArgb(8, 123, 104)
  $Accent = [System.Drawing.Color]::FromArgb(20, 145, 121)
  $TealBrush = New-Object System.Drawing.SolidBrush $Teal
  $AccentBrush = New-Object System.Drawing.SolidBrush $Accent
  $InnerLinePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(115, 8, 123, 104)), ([Math]::Max(0.8, $S * 0.008))

  $Corner = [Math]::Max(4, $S * 0.22)
  Fill-Round $G $Bg $X $Y $S $S $Corner

  $MonoBold = New-Object System.Drawing.Font 'Cascadia Code', ([float]($S * 0.44)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  if ($MonoBold.Name -ne 'Cascadia Code') {
    $MonoBold.Dispose()
    $MonoBold = New-Object System.Drawing.Font 'Consolas', ([float]($S * 0.44)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  }

  $Format = New-Object System.Drawing.StringFormat
  $Format.Alignment = [System.Drawing.StringAlignment]::Near
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $BraceFormat = New-Object System.Drawing.StringFormat
  $BraceFormat.Alignment = [System.Drawing.StringAlignment]::Center
  $BraceFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

  $WholeRect = New-Object System.Drawing.RectangleF ($X + $S * 0.06), ($Y + $S * 0.10), ($S * 0.88), ($S * 0.80)

  $LeftBrace = New-Object System.Drawing.RectangleF ($WholeRect.X + $S * 0.01), ($WholeRect.Y), ($WholeRect.Width * 0.30), ($WholeRect.Height)
  $RightBrace = New-Object System.Drawing.RectangleF ($WholeRect.X + $WholeRect.Width * 0.69), ($WholeRect.Y), ($WholeRect.Width * 0.30), ($WholeRect.Height)
  $G.DrawString('{', $MonoBold, $TealBrush, $LeftBrace, $BraceFormat)
  $G.DrawString('}', $MonoBold, $TealBrush, $RightBrace, $BraceFormat)

  $IndentY1 = $WholeRect.Y + $WholeRect.Height * 0.24
  $IndentY2 = $WholeRect.Y + $WholeRect.Height * 0.40
  $IndentY3 = $WholeRect.Y + $WholeRect.Height * 0.56
  $IndentY4 = $WholeRect.Y + $WholeRect.Height * 0.72

  $InsetL = $WholeRect.X + $WholeRect.Width * 0.28
  $InsetR1 = $WholeRect.X + $WholeRect.Width * 0.42
  $InsetR2 = $WholeRect.X + $WholeRect.Width * 0.52
  $InsetR3 = $WholeRect.X + $WholeRect.Width * 0.68
  $InsetR4 = $WholeRect.X + $WholeRect.Width * 0.48

  $G.DrawLine($InnerLinePen, (New-Object System.Drawing.PointF ($InsetL), ($IndentY1)), (New-Object System.Drawing.PointF ($InsetR1), ($IndentY1)))
  $G.DrawLine($InnerLinePen, (New-Object System.Drawing.PointF ($InsetL + $S * 0.04), ($IndentY2)), (New-Object System.Drawing.PointF ($InsetR2), ($IndentY2)))
  $G.DrawLine($InnerLinePen, (New-Object System.Drawing.PointF ($InsetL + $S * 0.04), ($IndentY3)), (New-Object System.Drawing.PointF ($InsetR3), ($IndentY3)))
  $G.DrawLine($InnerLinePen, (New-Object System.Drawing.PointF ($InsetL), ($IndentY4)), (New-Object System.Drawing.PointF ($InsetR4), ($IndentY4)))

  $Bg.Dispose(); $TealBrush.Dispose(); $AccentBrush.Dispose()
  if ($Shadow) { $Shadow.Dispose() }
  if ($IndentBrush) { $IndentBrush.Dispose() }
  if ($InnerLinePen) { $InnerLinePen.Dispose() }
  if ($MonoBold) { $MonoBold.Dispose() }
  if ($AccentFont) { $AccentFont.Dispose() }
  if ($Format) { $Format.Dispose() }
  if ($BraceFormat) { $BraceFormat.Dispose() }
  if ($MidFormat) { $MidFormat.Dispose() }
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
