<?php

$OUTDIR = $_SERVER['DOCUMENT_ROOT'] . '/.storage';
$filename = $_POST['filename'];
$text = $_POST['text'];

if (!$filename || !$text) {
  http_response_code(400);
  die;
}

$rec = array(
  'filename' => $filename,
  'text' => $text,
);

$json = json_encode($rec);
$hash = md5($json);
$outfn = "$OUTDIR/$hash";

$result = file_put_contents($outfn, $json);
if (!$result) {
  http_response_code(500);
  die;
}

header('Content-Type: text/json');
echo json_encode(array('key' => $hash));

?>
