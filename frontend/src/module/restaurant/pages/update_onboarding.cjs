const fs = require('fs');
const path = 'c:\\Grhapoch\\frontend\\src\\module\\restaurant\\pages\\Onboarding.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state and pincode to step1 location initial state
content = content.replace(
    /area: "",\s*city: "",\s*landmark: ""/,
    'area: "",\n      city: "",\n      state: "",\n      pincode: "",\n      landmark: ""'
);

// 2. Update validateField for restaurantName (with format restriction)
content = content.replace(
    /case 'restaurantName': \{[\s\S]*?if \(!v\) error = "Restaurant name is required";[\s\S]*?else if \(v\.length < 3 \|\| v\.length > 60\) error = "Restaurant name must be between 3 and 60 characters\.";[\s\S]*?else if \(\/\\\d\+\$\/\.test\(v\)\) error = "Restaurant name cannot contain only numbers\.";/,
    "case 'restaurantName': {\n        const v = newValue !== undefined ? newValue : step1.restaurantName?.trim();\n        if (!v) error = \"Restaurant name is required\";\n        else if (v.length < 3 || v.length > 60) error = \"Restaurant name must be between 3 and 60 characters.\";\n        else if (!/^[a-zA-Z0-9\\s&'()-.]+$/.test(v)) error = \"Invalid format. Allowed: A-Z, 0-9, &, ', (, ), -, .\";\n        else if (/^\\d+$/.test(v)) error = \"Restaurant name cannot contain only numbers.\";"
);

// 3. Add validateField for state and pincode
content = content.replace(
    /case 'city': \{[\s\S]*?if \(!v\) error = "City is required";[\s\S]*?else if \(!\/\^\[A-Za-z\\s\]\+\$\/\.test\(v\) \|\| v\.length < 2\) error = "Please enter a valid city name\.";\s*break;\s*\}/,
    "case 'city': {\n        const v = newValue !== undefined ? newValue : step1.location?.city?.trim();\n        if (!v) error = \"City is required\";\n        else if (!/^[A-Za-z\\s]+$/.test(v) || v.length < 2) error = \"Please enter a valid city name.\";\n        break;\n      }\n      case 'state': {\n        const v = newValue !== undefined ? newValue : step1.location?.state?.trim();\n        if (!v) error = \"State is required\";\n        else if (!/^[A-Za-z\\s]+$/.test(v) || v.length < 2) error = \"Please enter a valid state name.\";\n        break;\n      }\n      case 'pincode': {\n        const v = (newValue !== undefined ? newValue : step1.location?.pincode)?.trim()?.replace(/\\D/g, '');\n        if (!v) error = \"Pin code is required\";\n        else if (!/^\\d{6}$/.test(v)) error = \"Please enter a valid 6-digit pin code.\";\n        break;\n      }"
);

// 4. Update stepFields for step 1
content = content.replace(
    /\"area\",\s*\"city\",\s*\"addressLine1\"/,
    '\"area\",\n        \"city\",\n        \"state\",\n        \"pincode\",\n        \"addressLine1\"'
);

// 5. Update renderStep1 to include state and pincode inputs
// We'll insert after City input
const cityBlockRegex = /<div>\s*<Label className=\"text-xs text-gray-700\">City<span className=\"text-red-500\">\*<\/span><\/Label>[\s\S]*?{formErrors\.city && <p className=\"text-red-500 text-\[10px\] mt-1\">{formErrors\.city}<\/p>}\s*<\/div>/;
const statePincodeBlock = `          <div>
            <Label className="text-xs text-gray-700">State<span className="text-red-500">*</span></Label>
            <Input
              value={step1.location?.state || ""}
              onChange={(e) => {
                const val = e.target.value;
                setStep1({
                  ...step1,
                  location: { ...step1.location, state: val }
                });
                validateField('state', val);
              }}
              onFocus={() => setFormErrors(prev => ({ ...prev, state: null }))}
              onBlur={() => validateField('state')}
              className={\`bg-white text-sm \${formErrors.state ? "border-red-500" : "border-gray-200"}\`}
              placeholder="State name" />
            {formErrors.state && <p className="text-red-500 text-[10px] mt-1">{formErrors.state}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-700">Pin Code<span className="text-red-500">*</span></Label>
            <Input
              value={step1.location?.pincode || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\\D/g, "").slice(0, 6);
                setStep1({
                  ...step1,
                  location: { ...step1.location, pincode: val }
                });
                validateField('pincode', val);
              }}
              onFocus={() => setFormErrors(prev => ({ ...prev, pincode: null }))}
              onBlur={() => validateField('pincode')}
              className={\`bg-white text-sm \${formErrors.pincode ? "border-red-500" : "border-gray-200"}\`}
              placeholder="6-digit Pin Code" />
            {formErrors.pincode && <p className="text-red-500 text-[10px] mt-1">{formErrors.pincode}</p>}
          </div>`;

content = content.replace(cityBlockRegex, (match) => match + '\n\n' + statePincodeBlock);

fs.writeFileSync(path, content);
console.log('Successfully updated Onboarding.jsx');
