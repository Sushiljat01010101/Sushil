<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Get latitude and longitude from POST request
    $latitude = $_POST['latitude'];
    $longitude = $_POST['longitude'];

    // Generate Google Maps link
    $googleMapsLink = "https://www.google.com/maps?q=" . $latitude . "," . $longitude;

    // Data to be saved
    $data = "Google Maps Link: " . $googleMapsLink . "\n";

    // Specify the file where data will be saved
    $file = 'data.txt';

    // Save the data to the file
    if (file_put_contents($file, $data, FILE_APPEND | LOCK_EX)) {
        echo "Location saved successfully!";
    } else {
        echo "Failed to save location.";
    }
} else {
    echo "No data received.";
}
?>
