# PowerShell console Tetris
# Controls: arrow keys, Space = hard drop, P = pause, Q = quit

$ErrorActionPreference = 'Stop'

$boardWidth = 10
$boardHeight = 20
$board = New-Object 'int[,]' $boardHeight, $boardWidth
$score = 0
$lines = 0
$level = 1
$gameOver = $false
$paused = $false
$random = [System.Random]::new()

$pieces = @(
    @{ Name = 'I'; Color = 11; Pattern = @('....', 'XXXX', '....', '....') },
    @{ Name = 'O'; Color = 14; Pattern = @('.XX.', '.XX.', '....', '....') },
    @{ Name = 'T'; Color = 13; Pattern = @('.X..', 'XXX.', '....', '....') },
    @{ Name = 'S'; Color = 10; Pattern = @('.XX.', 'XX..', '....', '....') },
    @{ Name = 'Z'; Color = 12; Pattern = @('XX..', '.XX.', '....', '....') },
    @{ Name = 'J'; Color = 9;  Pattern = @('X...', 'XXX.', '....', '....') },
    @{ Name = 'L'; Color = 6;  Pattern = @('..X.', 'XXX.', '....', '....') }
)

function New-Piece {
    $definition = $pieces[$random.Next(0, $pieces.Count)]
    return [pscustomobject]@{
        Definition = $definition
        X = 3
        Y = -1
        Rotation = 0
    }
}

function Get-PieceCells($piece, [int]$rotation = $piece.Rotation, [int]$offsetX = $piece.X, [int]$offsetY = $piece.Y) {
    for ($y = 0; $y -lt 4; $y++) {
        for ($x = 0; $x -lt 4; $x++) {
            if ($piece.Definition.Pattern[$y][$x] -ne 'X') { continue }

            $rx = $x
            $ry = $y
            for ($r = 0; $r -lt ($rotation % 4); $r++) {
                $oldX = $rx
                $rx = 3 - $ry
                $ry = $oldX
            }

            [pscustomobject]@{ X = $offsetX + $rx; Y = $offsetY + $ry }
        }
    }
}

function Test-Position($piece, [int]$x, [int]$y, [int]$rotation) {
    foreach ($cell in (Get-PieceCells $piece $rotation $x $y)) {
        if ($cell.X -lt 0 -or $cell.X -ge $boardWidth -or $cell.Y -ge $boardHeight) {
            return $false
        }
        if ($cell.Y -ge 0 -and $board[$cell.Y, $cell.X] -ne 0) {
            return $false
        }
    }
    return $true
}

function Move-Piece([int]$dx, [int]$dy) {
    if (Test-Position $current ($current.X + $dx) ($current.Y + $dy) $current.Rotation) {
        $current.X += $dx
        $current.Y += $dy
        return $true
    }
    return $false
}

function Rotate-Piece {
    $newRotation = ($current.Rotation + 1) % 4
    foreach ($kick in @(0, -1, 1, -2, 2)) {
        if (Test-Position $current ($current.X + $kick) $current.Y $newRotation) {
            $current.X += $kick
            $current.Rotation = $newRotation
            return
        }
    }
}

function Lock-Piece {
    foreach ($cell in (Get-PieceCells $current)) {
        if ($cell.Y -lt 0) {
            $script:gameOver = $true
            return
        }
        $board[$cell.Y, $cell.X] = $current.Definition.Color
    }
}

function Remove-FullLines {
    $removed = 0
    for ($y = $boardHeight - 1; $y -ge 0; $y--) {
        $full = $true
        for ($x = 0; $x -lt $boardWidth; $x++) {
            if ($board[$y, $x] -eq 0) {
                $full = $false
                break
            }
        }

        if ($full) {
            for ($pullY = $y; $pullY -gt 0; $pullY--) {
                for ($x = 0; $x -lt $boardWidth; $x++) {
                    $board[$pullY, $x] = $board[($pullY - 1), $x]
                }
            }
            for ($x = 0; $x -lt $boardWidth; $x++) { $board[0, $x] = 0 }
            $removed++
            $y++
        }
    }

    if ($removed -gt 0) {
        $points = @(0, 100, 300, 500, 800)
        $script:score += $points[$removed] * $level
        $script:lines += $removed
        $script:level = [math]::Floor($lines / 10) + 1
    }
}

function Write-Cell([int]$color) {
    if ($color -eq 0) {
        [Console]::BackgroundColor = [ConsoleColor]::Black
        [Console]::Write('  ')
    }
    else {
        [Console]::BackgroundColor = [ConsoleColor]$color
        [Console]::Write('  ')
        [Console]::BackgroundColor = [ConsoleColor]::Black
    }
}

function Draw-Game {
    $display = New-Object 'int[,]' $boardHeight, $boardWidth
    for ($y = 0; $y -lt $boardHeight; $y++) {
        for ($x = 0; $x -lt $boardWidth; $x++) { $display[$y, $x] = $board[$y, $x] }
    }
    foreach ($cell in (Get-PieceCells $current)) {
        if ($cell.Y -ge 0 -and $cell.Y -lt $boardHeight -and $cell.X -ge 0 -and $cell.X -lt $boardWidth) {
            $display[$cell.Y, $cell.X] = $current.Definition.Color
        }
    }

    [Console]::SetCursorPosition(0, 0)
    [Console]::ForegroundColor = [ConsoleColor]::White
    [Console]::BackgroundColor = [ConsoleColor]::Black
    [Console]::WriteLine('+' + ('--' * $boardWidth) + '+')
    for ($y = 0; $y -lt $boardHeight; $y++) {
        [Console]::Write('|')
        for ($x = 0; $x -lt $boardWidth; $x++) { Write-Cell $display[$y, $x] }
        [Console]::Write('|')
        switch ($y) {
            1 { [Console]::Write(('   Score: {0,-8}' -f $score)) }
            3 { [Console]::Write(('   Lines: {0,-8}' -f $lines)) }
            5 { [Console]::Write(('   Level: {0,-8}' -f $level)) }
            8 { [Console]::Write('   Controls') }
            9 { [Console]::Write('   Left/Right: Move') }
            10 { [Console]::Write('   Up: Rotate') }
            11 { [Console]::Write('   Down: Soft drop') }
            12 { [Console]::Write('   Space: Hard drop') }
            13 { [Console]::Write('   P: Pause / Q: Quit') }
        }
        [Console]::WriteLine()
    }
    [Console]::WriteLine('+' + ('--' * $boardWidth) + '+')
    if ($paused) { [Console]::Write('  PAUSED - Press P to continue.          ') }
    else { [Console]::Write('                                         ') }
}

$originalCursorVisible = [Console]::CursorVisible
$originalForeground = [Console]::ForegroundColor
$originalBackground = [Console]::BackgroundColor

try {
    [Console]::CursorVisible = $false
    [Console]::Clear()
    $current = New-Piece
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    $lastDrop = 0L

    while (-not $gameOver) {
        while ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq [ConsoleKey]::Q) { $gameOver = $true; break }
            if ($key.Key -eq [ConsoleKey]::P) { $paused = -not $paused; Draw-Game; continue }
            if ($paused) { continue }

            switch ($key.Key) {
                'LeftArrow'  { [void](Move-Piece -1 0) }
                'RightArrow' { [void](Move-Piece 1 0) }
                'UpArrow'    { Rotate-Piece }
                'DownArrow'  { if (Move-Piece 0 1) { $score++ } }
                'Spacebar' {
                    $distance = 0
                    while (Move-Piece 0 1) { $distance++ }
                    $score += $distance * 2
                    Lock-Piece
                    if (-not $gameOver) { Remove-FullLines; $current = New-Piece }
                    $lastDrop = $timer.ElapsedMilliseconds
                }
            }
        }

        if (-not $paused -and -not $gameOver) {
            $dropInterval = [math]::Max(90, 700 - (($level - 1) * 55))
            if (($timer.ElapsedMilliseconds - $lastDrop) -ge $dropInterval) {
                if (-not (Move-Piece 0 1)) {
                    Lock-Piece
                    if (-not $gameOver) { Remove-FullLines; $current = New-Piece }
                }
                $lastDrop = $timer.ElapsedMilliseconds
            }
            Draw-Game
        }
        Start-Sleep -Milliseconds 25
    }

    Draw-Game
    [Console]::SetCursorPosition(0, $boardHeight + 3)
    [Console]::ForegroundColor = [ConsoleColor]::Yellow
    [Console]::WriteLine("Game over! Final score: $score")
}
finally {
    [Console]::BackgroundColor = $originalBackground
    [Console]::ForegroundColor = $originalForeground
    [Console]::CursorVisible = $originalCursorVisible
}
