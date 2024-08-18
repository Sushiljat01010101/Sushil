<?php
// save_location.php

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data
    $data = file_get_contents('php://input');

    // Decode JSON data
    $locationData = json_decode($data, true);

    // Get latitude and longitude
    $latitude = $locationData['latitude'];
    $longitude = $locationData['longitude'];

    // Format the data
    $locationString = "Latitude: $latitude, Longitude: $longitude\n";

    // Save the location data to a text file
    file_put_contents('contact.txt', $locationString, FILE_APPEND);

    // Return a response
    echo 'Location saved successfully';
    exit;
}
?>
