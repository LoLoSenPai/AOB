param(
  [string]$PublicRoot = (Join-Path $PSScriptRoot "..\public"),
  [string]$SourceRoot = (Join-Path $PublicRoot "_source\aob-map\atlases"),
  [string]$OutputRoot = (Join-Path $PublicRoot "assets\aob-map\runtime")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$terrainFrameSize = 128
$alphaThreshold = 8

function Use-NearestNeighbor {
  param([System.Drawing.Graphics]$Graphics)

  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
}

function Get-GridRect {
  param(
    [int]$ImageWidth,
    [int]$ImageHeight,
    [int]$Columns,
    [int]$Rows,
    [int]$Column,
    [int]$Row,
    [int]$InsetX = 0,
    [int]$InsetY = 0
  )

  $left = [int][Math]::Floor($Column * $ImageWidth / $Columns) + $InsetX
  $top = [int][Math]::Floor($Row * $ImageHeight / $Rows) + $InsetY
  $rightExclusive = [int][Math]::Floor(($Column + 1) * $ImageWidth / $Columns) - $InsetX
  $bottomExclusive = [int][Math]::Floor(($Row + 1) * $ImageHeight / $Rows) - $InsetY
  $width = [Math]::Max(1, $rightExclusive - $left)
  $height = [Math]::Max(1, $bottomExclusive - $top)

  return [System.Drawing.Rectangle]::new($left, $top, $width, $height)
}

function Get-FrameRect {
  param(
    [int]$FrameIndex,
    [int]$FrameWidth,
    [int]$FrameHeight,
    [int]$Columns
  )

  $x = ($FrameIndex % $Columns) * $FrameWidth
  $y = [Math]::Floor($FrameIndex / $Columns) * $FrameHeight
  return [System.Drawing.Rectangle]::new($x, $y, $FrameWidth, $FrameHeight)
}

function Get-AlphaBounds {
  param([System.Drawing.Bitmap]$Image)

  $minX = $Image.Width
  $minY = $Image.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = 0; $x -lt $Image.Width; $x++) {
      $pixel = $Image.GetPixel($x, $y)
      if ($pixel.A -le $alphaThreshold) {
        continue
      }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt 0) {
    return $null
  }

  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function Get-BackgroundBounds {
  param(
    [System.Drawing.Bitmap]$Image,
    [int]$Tolerance = 24
  )

  $background = $Image.GetPixel(0, 0)
  $minX = $Image.Width
  $minY = $Image.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Image.Height; $y++) {
    for ($x = 0; $x -lt $Image.Width; $x++) {
      $pixel = $Image.GetPixel($x, $y)
      $distance = [Math]::Abs([int]$pixel.R - [int]$background.R) + [Math]::Abs([int]$pixel.G - [int]$background.G) + [Math]::Abs([int]$pixel.B - [int]$background.B)
      if ($distance -le $Tolerance) {
        continue
      }
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }

  if ($maxX -lt 0) {
    return [System.Drawing.Rectangle]::new(0, 0, $Image.Width, $Image.Height)
  }

  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function Export-TrimmedGridSprite {
  param(
    [string]$SourcePath,
    [int]$Columns,
    [int]$Rows,
    [int]$Column,
    [int]$Row,
    [string]$OutputPath,
    [int]$Padding = 2
  )

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $cellRect = Get-GridRect -ImageWidth $source.Width -ImageHeight $source.Height -Columns $Columns -Rows $Rows -Column $Column -Row $Row
    $cell = [System.Drawing.Bitmap]::new($cellRect.Width, $cellRect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $cellGraphics = [System.Drawing.Graphics]::FromImage($cell)
    $cellGraphics.Clear([System.Drawing.Color]::Transparent)
    Use-NearestNeighbor -Graphics $cellGraphics
    $cellGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $cellRect.Width, $cellRect.Height), $cellRect, [System.Drawing.GraphicsUnit]::Pixel)
    $cellGraphics.Dispose()

    $bounds = Get-AlphaBounds -Image $cell
    if (-not $bounds) {
      throw "No opaque pixels detected in $SourcePath at cell $Column,$Row."
    }

    $target = [System.Drawing.Bitmap]::new($bounds.Width + ($Padding * 2), $bounds.Height + ($Padding * 2), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $targetGraphics = [System.Drawing.Graphics]::FromImage($target)
    $targetGraphics.Clear([System.Drawing.Color]::Transparent)
    Use-NearestNeighbor -Graphics $targetGraphics
    $targetGraphics.DrawImage(
      $cell,
      [System.Drawing.Rectangle]::new($Padding, $Padding, $bounds.Width, $bounds.Height),
      $bounds,
      [System.Drawing.GraphicsUnit]::Pixel
    )
    $targetGraphics.Dispose()
    $target.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $target.Dispose()
    $cell.Dispose()
  }
  finally {
    $source.Dispose()
  }
}

function Export-GridCell {
  param(
    [string]$SourcePath,
    [int]$Columns,
    [int]$Rows,
    [int]$Column,
    [int]$Row,
    [string]$OutputPath,
    [int]$InsetX = 6,
    [int]$InsetY = 6
  )

  $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $rect = Get-GridRect -ImageWidth $source.Width -ImageHeight $source.Height -Columns $Columns -Rows $Rows -Column $Column -Row $Row -InsetX $InsetX -InsetY $InsetY
    $cell = [System.Drawing.Bitmap]::new($rect.Width, $rect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $cellGraphics = [System.Drawing.Graphics]::FromImage($cell)
    $cellGraphics.Clear([System.Drawing.Color]::Transparent)
    Use-NearestNeighbor -Graphics $cellGraphics
    $cellGraphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $cellGraphics.Dispose()

    $bounds = Get-BackgroundBounds -Image $cell
    $target = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    Use-NearestNeighbor -Graphics $graphics
    $graphics.DrawImage($cell, [System.Drawing.Rectangle]::new(0, 0, $bounds.Width, $bounds.Height), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $target.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $target.Dispose()
    $cell.Dispose()
  }
  finally {
    $source.Dispose()
  }
}

function Export-ResizedCrop {
  param(
    [System.Drawing.Bitmap]$Source,
    [System.Drawing.Rectangle]$SourceRect,
    [System.Drawing.Graphics]$TargetGraphics,
    [int]$DestinationFrame
  )

  $frameColumns = 4
  $destX = ($DestinationFrame % $frameColumns) * $terrainFrameSize
  $destY = [Math]::Floor($DestinationFrame / $frameColumns) * $terrainFrameSize
  $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $terrainFrameSize, $terrainFrameSize)
  $TargetGraphics.DrawImage($Source, $destRect, $SourceRect, [System.Drawing.GraphicsUnit]::Pixel)
}

function Build-TerrainSheet {
  $atlas1Path = Join-Path $SourceRoot "atlas-map-1.png"
  $atlas2Path = Join-Path $SourceRoot "atlas-map-2-new.png"
  $atlas5Path = Join-Path $SourceRoot "atlas-map-5.png"
  $legacyPath = Join-Path $PublicRoot "assets\aob-map\optimized\terrain-tiles-128-clean.png"

  $atlas1 = [System.Drawing.Bitmap]::FromFile($atlas1Path)
  $atlas2 = [System.Drawing.Bitmap]::FromFile($atlas2Path)
  $atlas5 = [System.Drawing.Bitmap]::FromFile($atlas5Path)
  $legacy = [System.Drawing.Bitmap]::FromFile($legacyPath)

  try {
    $sheet = [System.Drawing.Bitmap]::new(512, 384, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($sheet)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    Use-NearestNeighbor -Graphics $graphics

    $terrainSources = @(
      @{ Frame = 0; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 0 -Row 0 -InsetX 18 -InsetY 18) },
      @{ Frame = 1; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 4 -Row 0 -InsetX 18 -InsetY 18) },
      @{ Frame = 2; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 2 -Row 2 -InsetX 18 -InsetY 18) },
      @{ Frame = 3; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 3 -Row 1 -InsetX 18 -InsetY 18) },
      @{ Frame = 4; Bitmap = $legacy; Rect = (Get-FrameRect -FrameIndex 4 -FrameWidth 128 -FrameHeight 128 -Columns 4) },
      @{ Frame = 5; Bitmap = $legacy; Rect = (Get-FrameRect -FrameIndex 5 -FrameWidth 128 -FrameHeight 128 -Columns 4) },
      @{ Frame = 6; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 4 -Row 1 -InsetX 18 -InsetY 18) },
      @{ Frame = 7; Bitmap = $atlas2; Rect = (Get-GridRect -ImageWidth $atlas2.Width -ImageHeight $atlas2.Height -Columns 7 -Rows 5 -Column 3 -Row 4 -InsetX 10 -InsetY 10) },
      @{ Frame = 8; Bitmap = $atlas1; Rect = (Get-GridRect -ImageWidth $atlas1.Width -ImageHeight $atlas1.Height -Columns 5 -Rows 3 -Column 4 -Row 2 -InsetX 18 -InsetY 18) },
      @{ Frame = 9; Bitmap = $legacy; Rect = (Get-FrameRect -FrameIndex 9 -FrameWidth 128 -FrameHeight 128 -Columns 4) },
      @{ Frame = 10; Bitmap = $legacy; Rect = (Get-FrameRect -FrameIndex 10 -FrameWidth 128 -FrameHeight 128 -Columns 4) },
      @{ Frame = 11; Bitmap = $legacy; Rect = (Get-FrameRect -FrameIndex 11 -FrameWidth 128 -FrameHeight 128 -Columns 4) }
    )

    foreach ($source in $terrainSources) {
      Export-ResizedCrop -Source $source.Bitmap -SourceRect $source.Rect -TargetGraphics $graphics -DestinationFrame $source.Frame
    }

    $outputPath = Join-Path $OutputRoot "terrain-tiles-128.png"
    $sheet.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $sheet.Dispose()
    Write-Output "Generated $outputPath"
  }
  finally {
    $atlas1.Dispose()
    $atlas2.Dispose()
    $atlas5.Dispose()
    $legacy.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$transparentSprites = @(
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 0; Row = 0; Output = "trees.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 1; Row = 0; Output = "trees-alt.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 4; Row = 0; Output = "pine-tree.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 2; Row = 1; Output = "bush.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 3; Row = 1; Output = "fruit-bush.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 4; Row = 1; Output = "flower-patch.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 5; Row = 1; Output = "grass-patch.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 3; Row = 2; Output = "rock.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 4; Row = 2; Output = "rocks.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 0; Row = 3; Output = "stump.png" },
  @{ Source = "atlas-map-3.png"; Columns = 6; Rows = 4; Column = 4; Row = 3; Output = "crystal-sprout.png" },
  @{ Source = "atlas-map-4.png"; Columns = 6; Rows = 3; Column = 0; Row = 0; Output = "big-rocks.png" },
  @{ Source = "atlas-map-4.png"; Columns = 6; Rows = 3; Column = 2; Row = 0; Output = "stone-node-alt.png" },
  @{ Source = "atlas-map-4.png"; Columns = 6; Rows = 3; Column = 0; Row = 1; Output = "crystal-node.png" },
  @{ Source = "atlas-map-4.png"; Columns = 6; Rows = 3; Column = 4; Row = 1; Output = "crystal-node-alt.png" },
  @{ Source = "atlas-map-4.png"; Columns = 6; Rows = 3; Column = 3; Row = 2; Output = "wood-pile.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 4; Row = 0; Output = "crates.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 5; Row = 0; Output = "barrels.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 0; Row = 1; Output = "sacks.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 1; Row = 1; Output = "fence.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 2; Row = 1; Output = "fence-corner.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 3; Row = 1; Output = "sign.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 4; Row = 1; Output = "flag.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 5; Row = 1; Output = "torch.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 2; Row = 2; Output = "cart.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 4; Row = 2; Output = "well.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 5; Row = 2; Output = "anvil.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 0; Row = 3; Output = "log-stack.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 1; Row = 3; Output = "trough.png" },
  @{ Source = "atlas-map-5.png"; Columns = 6; Rows = 4; Column = 2; Row = 3; Output = "bench.png" }
)

foreach ($sprite in $transparentSprites) {
  $sourcePath = Join-Path $SourceRoot $sprite.Source
  $outputPath = Join-Path $OutputRoot $sprite.Output
  Export-TrimmedGridSprite -SourcePath $sourcePath -Columns $sprite.Columns -Rows $sprite.Rows -Column $sprite.Column -Row $sprite.Row -OutputPath $outputPath
  Write-Output "Generated $outputPath"
}

Build-TerrainSheet
