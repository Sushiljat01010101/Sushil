<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $latitude = $_POST['latitude'];
    $longitude = $_POST['longitude'];

    // Creating the Google Maps link
    $googleMapsLink = "https://www.google.com/maps?q=" . $latitude . "," . $longitude;

    $data = "Google Maps Link: " . $googleMapsLink . "\n";
    $file = 'data.txt';

    if (file_put_contents($file, $data, FILE_APPEND | LOCK_EX)) {
        echo "Location saved successfully!";
    } else {
        echo "Failed to save location.";
    }
} else {
    echo "No data received.";
}
?>
