import wixData from 'wix-data';

let selectedFamily = null; 

$w.onReady(function () {

    $w('#linkedFamilyRepeater').collapse(); 

    // ==========================================
    // 1. DIRECT QUERY: SEARCH EXISTING FAMILIES (UPGRADED)
    // ==========================================
    $w('#input3').onInput(async () => {
        let keyword = $w('#input3').value;
        
        // Only search if they've typed at least 2 characters
        if (keyword.length > 1) {
            try {
                let results = await wixData.query('Import4') // Families collection
                    .contains('headOfFamily', keyword)
                    .or(wixData.query('Import4').contains('familyId', keyword))
                    .or(wixData.query('Import4').contains('directionsPhysicalLocation', keyword))
                    .or(wixData.query('Import4').contains('familyDescription', keyword))
                    .or(wixData.query('Import4').contains('staffNotes', keyword))                    
                    .or(wixData.query('Import4').contains('email', keyword))
                    .or(wixData.query('Import4').contains('primaryMailingAddress', keyword))
                    .limit(10) // Strictly limits the table to 10 rows
                    .find();
                
                $w('#familySearchTable').rows = results.items;
            } catch (error) {
                console.error("Search failed:", error);
            }
        } else {
            // Load defaults when search is cleared
            loadDefaultFamilies();
        }
    });

    // ==========================================
    // 2. UI TOGGLES
    // ==========================================
    $w('#addExistingFamily').onClick(() => {
        $w('#familySearchTable').expand();
        $w('#box248').collapse(); 
        
        // Load default families as soon as the table opens
        loadDefaultFamilies();
    });

    $w('#addNewFamily').onClick(() => {
        $w('#box248').expand();
        $w('#familySearchTable').collapse(); 
    });

    // ==========================================
    // 3. LINK EXISTING / REMOVE LINK
    // ==========================================
    $w('#familySearchTable').onRowSelect((event) => {
        selectedFamily = event.rowData; 
        updateRepeaterUI();
        $w('#familySearchTable').collapse(); 
    });

    $w('#removeLinkedFamilyButton').onClick(() => {
        selectedFamily = null;
        updateRepeaterUI();
    });

    // ==========================================
    // 4. SAVE & LINK A NEW FAMILY
    // ==========================================
    $w('#saveButton').onClick(async () => {
        let newFamId = "idfam-" + Date.now();

        let newFamilyData = {
            familyId: newFamId, 
            headOfFamily: $w('#headOffamilyInput').value, 
            familyDescription: $w('#familyDescriptionInput').value,
            staffNotes: $w('#staffNotes').value,
            primaryMailingAddress: $w('#primaryMailingAddressInput').value,
            phone: $w('#phone').value,
            directionsPhysicalLocation: $w('#directionsOrPhysAddress').value,
            email: $w('#email').value
        };

        try {
            let insertedFamily = await wixData.insert('Import4', newFamilyData); 
            selectedFamily = insertedFamily; 
            updateRepeaterUI();
            $w('#box248').collapse(); 
        } catch (error) {
            console.error("Failed to create new family:", error);
        }
    });

    // ==========================================
    // 5. FINAL SAVE: MULTI-REFERENCE LINKING & CONFIRMATION
    // ==========================================
    $w('#button28').onClick(async () => {
        if (!$w('#input2').value) return console.error("Req title is required");

        // Change button state to indicate processing
        $w('#button28').disable();
        $w('#button28').label = "Saving...";

        // Formats exactly to YYYY-MM-DD (Requires field type to be 'Text' in CMS)
        let dateString = new Date().toISOString().split('T')[0];

        let newOpId = "OP-" + Date.now();

        let newOperationData = {
            operationId: newOpId, 
            requestDonationDetails: $w('#input2').value, 
            forWho: $w('#input5').value,                 
            requestNotes: $w('#input1').value,           
            operationType: "Request",                    
            dateRequested: dateString, 
            whichOkini: $w('#dropdown1').value,
            coordinator: $w('#dropdown2').value,
            liveOnWebsite: $w('#switch1').checked, 
            urgentNeedStatus: $w('#urgentNeedStatus').checked 
        };

        try {
            // 1. Insert the Operation first
            let insertedOp = await wixData.insert('Import3', newOperationData);
            
            // 2. Insert the Multi-Reference Link (if a family is selected)
            if (selectedFamily) {
                await wixData.insertReference('Import3', 'linkedFamily', insertedOp._id, selectedFamily._id);
            }

            console.log("Operation successfully created and linked!");
            
            // Update button to show success
            $w('#button28').label = "Saved Successfully!";
            
            // Optional: Re-enable the button after 3 seconds if they want to make another request
            // setTimeout(() => {
            //     $w('#button28').label = "Save Request";
            //     $w('#button28').enable();
            //     // Add code here to clear inputs if you want a clean slate
            // }, 3000);

        } catch (error) {
            console.error("Failed to create Operation:", error);
            $w('#button28').label = "Error saving";
            $w('#button28').enable();
        }
    });

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================
    function updateRepeaterUI() {
        if (selectedFamily) {
            $w('#linkedFamilyRepeater').data = [selectedFamily]; 
            $w('#linkedFamilyRepeater').expand();
        } else {
            $w('#linkedFamilyRepeater').data = [];
            $w('#linkedFamilyRepeater').collapse();
        }
    }

    $w('#linkedFamilyRepeater').onItemReady(($item, itemData) => {
        $item('#linkedFamilyHead').text = itemData.headOfFamily || "N/A";
        $item('#linkedFamilyStaffNotes').text = itemData.staffNotes || "No staff notes available.";
        $item('#linkedFamilyComposition').text = itemData.familyDescription || "N/A";
    });

    // Fetches the 10 most recently added families to populate the default table
    async function loadDefaultFamilies() {
        try {
            let defaultResults = await wixData.query('Import4')
                .descending('_createdDate') // Sorts to show the newest families first
                .limit(10)
                .find();
            
            $w('#familySearchTable').rows = defaultResults.items;
        } catch (error) {
            console.error("Failed to load default families", error);
        }
    }
});