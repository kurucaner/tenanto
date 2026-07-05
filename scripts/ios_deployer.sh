#!/bin/bash

IPA_PATH=$(find . -name "*.ipa" | head -n 1)
echo "✅ Found IPA file at $IPA_PATH"
echo "✅ Starting the deployment process..."
# Upload the IPA file to App Store Connect using Transporter
upload_output=$(xcrun altool --upload-app -f "$IPA_PATH" -t ios --apiKey $API_KEY --apiIssuer $ISSUER_KEY 2>&1)
echo "$upload_output"
# Check if the upload was successful
if echo "$upload_output" | grep -q "No errors"; then
    echo "✅ Deployment is successful!"
else
    echo "❌ Deployment failed. Please check the output above for errors."
    exit 1
fi