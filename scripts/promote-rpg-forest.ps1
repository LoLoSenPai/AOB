param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$sourceRoot = Join-Path $ProjectRoot "public\_source\rpg-forest"
$tilesetSourceRoot = Join-Path $sourceRoot "Tilesets"
$mapSourceRoot = Join-Path $sourceRoot "Sample Map\maps"
$outputRoot = Join-Path $ProjectRoot "public\assets\editor\rpg-forest"
$tilesetOutputRoot = Join-Path $outputRoot "tilesets"
$mapOutputRoot = Join-Path $outputRoot "maps"

if (-not (Test-Path -LiteralPath $tilesetSourceRoot)) {
  throw "Missing RPG Forest tileset source directory: $tilesetSourceRoot"
}
if (-not (Test-Path -LiteralPath $mapSourceRoot)) {
  throw "Missing RPG Forest sample maps directory: $mapSourceRoot"
}

New-Item -ItemType Directory -Force -Path $tilesetOutputRoot, $mapOutputRoot | Out-Null

$tilesets = @(
  @{ Source = "Forest Tileset.png"; Output = "forest-tileset.png" },
  @{ Source = "Forest Trees.png"; Output = "forest-trees.png" },
  @{ Source = "Forest water.png"; Output = "forest-water.png" },
  @{ Source = "Collision tile.png"; Output = "collision-tile.png" }
)

foreach ($tileset in $tilesets) {
  $source = Join-Path $tilesetSourceRoot $tileset.Source
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing RPG Forest tileset: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $tilesetOutputRoot $tileset.Output) -Force
}

foreach ($mapName in "map1.json", "map2.json", "map4.json") {
  $source = Join-Path $mapSourceRoot $mapName
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing RPG Forest sample map: $source"
  }
  Copy-Item -LiteralPath $source -Destination (Join-Path $mapOutputRoot $mapName) -Force
}

Write-Output "RPG Forest editor assets promoted to $outputRoot"
