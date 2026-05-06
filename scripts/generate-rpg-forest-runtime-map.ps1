param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $ProjectRoot "public\_source\rpg-forest"
$tilesetRoot = Join-Path $sourceRoot "Tilesets"
$sampleMapRoot = Join-Path $sourceRoot "Sample Map\maps"
$outputRoot = Join-Path $ProjectRoot "public\assets\editor\rpg-forest\runtime"
$outputPath = Join-Path $outputRoot "rpg-forest-runtime-map.png"

if (-not (Test-Path -LiteralPath $tilesetRoot)) {
  throw "Missing RPG Forest tileset source directory: $tilesetRoot"
}
if (-not (Test-Path -LiteralPath $sampleMapRoot)) {
  throw "Missing RPG Forest sample map directory: $sampleMapRoot"
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$worldWidth = 224 * 16
$worldHeight = 176 * 16
$rpgTileSize = 24

function Load-Bitmap([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Missing image: $path"
  }
  return [System.Drawing.Bitmap]::FromFile($path)
}

function New-TileCrop([System.Drawing.Bitmap]$sheet, [int]$columns, [int]$frame) {
  $x = ($frame % $columns) * $rpgTileSize
  $y = [Math]::Floor($frame / $columns) * $rpgTileSize
  $tile = New-Object System.Drawing.Bitmap $rpgTileSize, $rpgTileSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $tileGraphics = [System.Drawing.Graphics]::FromImage($tile)
  $tileGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $tileGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $tileGraphics.DrawImage($sheet, (New-Object System.Drawing.Rectangle 0, 0, $rpgTileSize, $rpgTileSize), $x, $y, $rpgTileSize, $rpgTileSize, [System.Drawing.GraphicsUnit]::Pixel)
  $tileGraphics.Dispose()
  return $tile
}

function New-ImageCrop([System.Drawing.Bitmap]$source, [int]$x, [int]$y, [int]$width, [int]$height) {
  $crop = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $cropGraphics = [System.Drawing.Graphics]::FromImage($crop)
  $cropGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $cropGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $cropGraphics.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $width, $height), $x, $y, $width, $height, [System.Drawing.GraphicsUnit]::Pixel)
  $cropGraphics.Dispose()
  return $crop
}

function New-NoisyTexture([int]$width, [int]$height, [int[]]$base, [int[]]$dark, [int[]]$light) {
  $texture = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $height; $y += 1) {
    for ($x = 0; $x -lt $width; $x += 1) {
      $hash = (($x * 73856093) -bxor ($y * 19349663) -bxor (($x + $y) * 83492791)) -band 255
      if ($hash -lt 42) {
        $color = $dark
      } elseif ($hash -gt 216) {
        $color = $light
      } else {
        $color = $base
      }
      $texture.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $color[0], $color[1], $color[2]))
    }
  }

  $textureGraphics = [System.Drawing.Graphics]::FromImage($texture)
  $textureGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  for ($i = 0; $i -lt 72; $i += 1) {
    $x = (($i * 37) % $width)
    $y = (($i * 61) % $height)
    $length = 2 + (($i * 11) % 5)
    $brushColor = $(if (($i % 3) -eq 0) { $light } else { $dark })
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(130, $brushColor[0], $brushColor[1], $brushColor[2])), 1
    $textureGraphics.DrawLine($pen, $x, $y, [Math]::Min($width - 1, $x + $length), $y)
    $pen.Dispose()
  }
  $textureGraphics.Dispose()
  return $texture
}

function Fill-RectTexture([System.Drawing.Graphics]$graphics, [System.Drawing.Image]$texture, [int]$x, [int]$y, [int]$width, [int]$height) {
  $brush = New-Object System.Drawing.TextureBrush $texture
  $brush.TranslateTransform($x, $y)
  $graphics.FillRectangle($brush, $x, $y, $width, $height)
  $brush.Dispose()
}

function Fill-EllipseTexture([System.Drawing.Graphics]$graphics, [System.Drawing.Image]$texture, [int]$x, [int]$y, [int]$width, [int]$height) {
  $brush = New-Object System.Drawing.TextureBrush $texture
  $brush.TranslateTransform($x, $y)
  $graphics.FillEllipse($brush, $x, $y, $width, $height)
  $brush.Dispose()
}

function Draw-TexturePath(
  [System.Drawing.Graphics]$graphics,
  [System.Drawing.Image]$texture,
  [int]$width,
  [System.Drawing.Point[]]$points
) {
  if ($points.Length -lt 2) {
    return
  }
  $brush = New-Object System.Drawing.TextureBrush $texture
  $pen = New-Object System.Drawing.Pen $brush, $width
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($pen, $points)
  $pen.Dispose()
  $brush.Dispose()
}

function Draw-Sample([System.Drawing.Graphics]$graphics, [System.Drawing.Bitmap]$image, [int]$x, [int]$y, [int]$width = 0, [int]$height = 0) {
  $targetWidth = $(if ($width -gt 0) { $width } else { $image.Width })
  $targetHeight = $(if ($height -gt 0) { $height } else { $image.Height })
  $graphics.DrawImage($image, $x, $y, $targetWidth, $targetHeight)
}

function P([int]$x, [int]$y) {
  return New-Object System.Drawing.Point $x, $y
}

$forestSheet = Load-Bitmap (Join-Path $tilesetRoot "Forest Tileset.png")
$map1 = Load-Bitmap (Join-Path $sampleMapRoot "map1.png")
$map2 = Load-Bitmap (Join-Path $sampleMapRoot "map2.png")
$map4 = Load-Bitmap (Join-Path $sampleMapRoot "map4.png")

$grassTile = New-TileCrop $forestSheet 19 81
$grassAltTile = New-TileCrop $forestSheet 19 82
$dirtTexture = New-NoisyTexture 96 96 @(136, 88, 46) @(104, 67, 35) @(166, 119, 66)
$packedDirtTexture = New-NoisyTexture 96 96 @(118, 79, 46) @(82, 57, 40) @(154, 105, 62)
$stoneTexture = New-NoisyTexture 96 96 @(88, 92, 86) @(58, 62, 60) @(128, 132, 124)

$bitmap = New-Object System.Drawing.Bitmap $worldWidth, $worldHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

Fill-RectTexture $graphics $grassTile 0 0 $worldWidth $worldHeight

for ($y = 0; $y -lt $worldHeight; $y += 192) {
  for ($x = 0; $x -lt $worldWidth; $x += 192) {
    if ((($x * 17 + $y * 31) % 5) -eq 0) {
      Fill-RectTexture $graphics $grassAltTile $x $y 192 192
    }
  }
}

Draw-Sample $graphics $map4 0 0 970 720
Draw-Sample $graphics $map2 0 610 1008 720
Draw-Sample $graphics $map4 0 1220 970 720
Draw-Sample $graphics $map2 0 1940 1008 720
Draw-Sample $graphics $map1 1030 60 972 540
Draw-Sample $graphics $map1 1230 1880 972 540
Draw-Sample $graphics $map2 2310 220 1008 720
Draw-Sample $graphics $map4 2500 1180 970 720
Draw-Sample $graphics $map1 2190 2070 972 540

$darkEdge = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(54, 16, 26, 13))
$graphics.FillRectangle($darkEdge, 0, 0, $worldWidth, 72)
$graphics.FillRectangle($darkEdge, 0, $worldHeight - 72, $worldWidth, 72)
$graphics.FillRectangle($darkEdge, 0, 0, 72, $worldHeight)
$graphics.FillRectangle($darkEdge, $worldWidth - 72, 0, 72, $worldHeight)
$darkEdge.Dispose()

Fill-EllipseTexture $graphics $stoneTexture 1500 560 360 260
Fill-EllipseTexture $graphics $packedDirtTexture 1500 1430 610 420
Fill-EllipseTexture $graphics $packedDirtTexture 2180 720 700 435
Fill-EllipseTexture $graphics $packedDirtTexture 2180 1970 720 455

Draw-TexturePath $graphics $dirtTexture 48 @(
  (P 930 940),
  (P 1180 920),
  (P 1470 830),
  (P 1680 710)
)
Draw-TexturePath $graphics $dirtTexture 52 @(
  (P 930 940),
  (P 1270 1100),
  (P 1660 1400),
  (P 1810 1620)
)
Draw-TexturePath $graphics $dirtTexture 58 @(
  (P 930 940),
  (P 1420 930),
  (P 2010 910),
  (P 2470 980)
)

$graphics.Dispose()
$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$grassTile.Dispose()
$grassAltTile.Dispose()
$dirtTexture.Dispose()
$packedDirtTexture.Dispose()
$stoneTexture.Dispose()
$forestSheet.Dispose()
$map1.Dispose()
$map2.Dispose()
$map4.Dispose()
$bitmap.Dispose()

Write-Output "Generated RPG Forest runtime map: $outputPath ($worldWidth x $worldHeight)"
