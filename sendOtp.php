<?php
// Function to send OTP using Textbelt API
function sendOtp($phoneNumber, $otp, $customMessage) {
    $message = "Your OTP is: $otp. $customMessage";

    // Prepare the API URL
    $url = "https://textbelt.com/text";

    // Prepare data
    $data = array(
        'phone' => $phoneNumber,
        'message' => $message,
        'key' => 'textbelt' // Textbelt ka default API key
    );

    // Send OTP via API
    $options = array(
        'http' => array(
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($data),
        ),
    );
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    // Check response
    if ($result === FALSE) {
        die('Error occurred');
    }

    return $result;
}

// Example usage
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $phoneNumber = $_POST['phoneNumber'];
    $customMessage = $_POST['customMessage'];
    $otp = rand(100000, 999999); // Generate a random OTP
    sendOtp($phoneNumber, $otp, $customMessage);
}
?>
