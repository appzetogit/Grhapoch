
$path = 'c:\Grhapoch\backend\controllers\adminController.js'
$content = [System.IO.File]::ReadAllText($path)

# Remove the slice(0, 10) that limits the orders sent to the frontend
$old = 'orders: stats.orders.slice(0, 10)'
$new = 'orders: stats.orders'

$content = $content.Replace($old, $new)

[System.IO.File]::WriteAllText($path, $content)
