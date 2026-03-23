import wixData from 'wix-data';

let selectedFamily = null; 
let isEditingFamily = false; 
let currentOperationId = null; // Stores the current post ID globally for immediate linking

$w.onReady(function () {

    // Hide the repeater by default
    $w('#linkedFamilyRepeater').collapse();

    // ==========================================
    // 1. PAGE LOAD: GET CURRENT POST & ID
    // ==========================================
    $w('#dynamicDataset').onReady(() => {
        let currentOperation = $w('#dynamicDataset').getCurrentItem();
        
        if (currentOperation) {
            currentOperationId = currentOperation._id; 
            loadExistingLinkedFamily(currentOperationId);
        }
    });

// ==========================================
    // 2. UI TOGGLES (With Default Loading)
    // ==========================================
    $w('#addExistingFamily').onClick(() => {
        $w('#familySearchTable').expand();
        $w('#box248').collapse(); 
        
        // Load default families as soon as the table opens
        loadDefaultFamilies();
    });

    $w('#addNewFamily').onClick(() => {
        isEditingFamily = false; 
        clearFamilyForm(); 
        $w('#box248').expand();
        $w('#familySearchTable').collapse(); 
    });

    // ==========================================
    // 3. SEARCH & IMMEDIATE LINK 
    // ==========================================
    $w('#input3').onInput(async () => {
        let keyword = $w('#input3').value;
        
        if (keyword.length > 1) {
            try {
                let results = await wixData.query('Import4') 
                    .contains('headOfFamily', keyword)
                    .or(wixData.query('Import4').contains('familyId', keyword))
                    .or(wixData.query('Import4').contains('directionsPhysicalLocation', keyword))
                    .or(wixData.query('Import4').contains('familyDescription', keyword))
                    .or(wixData.query('Import4').contains('staffNotes', keyword))                    
                    .or(wixData.query('Import4').contains('email', keyword))
                    .or(wixData.query('Import4').contains('primaryMailingAddress', keyword))
                    .limit(10) 
                    .find();
                
                $w('#familySearchTable').rows = results.items;
            } catch (error) {
                console.error("Search failed:", error);
            }
        } else {
            // If they delete their search query, reload the default families instead of a blank table
            loadDefaultFamilies(); 
        }
    });

    $w('#familySearchTable').onRowSelect(async (event) => {
        selectedFamily = event.rowData; 
        isEditingFamily = true; 
        updateRepeaterUI();
        $w('#familySearchTable').collapse(); 

        if (currentOperationId && selectedFamily) {
            try {
                await wixData.replaceReferences('Import3', 'linkedFamily', currentOperationId, [selectedFamily._id]);
                console.log("Existing family instantly linked!");
            } catch (err) {
                console.error("Instant link failed", err);
            }
        }
    });

    // ==========================================
    // 4. IMMEDIATE UNLINK (Remove Button)
    // ==========================================
    $w('#removeLinkedFamilyButton').onClick(async () => {
        selectedFamily = null; 
        updateRepeaterUI();

        // IMMEDIATE SAVE: Remove the link from the database (passing empty array [])
        if (currentOperationId) {
            try {
                await wixData.replaceReferences('Import3', 'linkedFamily', currentOperationId, []);
                console.log("Family instantly unlinked!");
            } catch (err) {
                console.error("Instant unlink failed", err);
            }
        }
    });

    // ==========================================
    // 5. THE "EDIT FAMILY" BUTTON
    // ==========================================
    $w('#button29').onClick(() => {
        isEditingFamily = true; 
        if (selectedFamily) populateFamilyForm(selectedFamily); 
        $w('#familySearchTable').collapse();
        $w('#box248').expand();
    });

    // ==========================================
    // 6. SAVE FAMILY & IMMEDIATE LINK (Box248)
    // ==========================================
    $w('#saveButton').onClick(async () => {
        let familyData = getFamilyFormData(); 

        try {
            if (isEditingFamily && selectedFamily) {
                familyData._id = selectedFamily._id; 
                familyData.familyId = selectedFamily.familyId; 
                selectedFamily = await wixData.update('Import4', familyData);
            } else {
                familyData.familyId = "idfam-" + Date.now();
                selectedFamily = await wixData.insert('Import4', familyData); 
            }

            updateRepeaterUI();
            $w('#box248').collapse(); 

            // IMMEDIATE SAVE: Link the newly created/updated family
            if (currentOperationId && selectedFamily) {
                await wixData.replaceReferences('Import3', 'linkedFamily', currentOperationId, [selectedFamily._id]);
                console.log("New/Edited family instantly linked!");
            }

        } catch (error) {
            console.error("Failed to save family:", error);
        }
    });

    // ==========================================
    // 7. FINAL SAVE POST BUTTON (Standard Fields Only)
    // ==========================================
    $w('#button28').onClick(async () => {
        $w('#button28').disable();
        $w('#button28').label = "Saving...";

        try {
            // Because references are already handled immediately, we only need to save the dataset
            await $w('#dynamicDataset').save(); 

            $w('#button28').label = "Saved Successfully!";
            setTimeout(() => {
                $w('#button28').label = "Save Changes";
                $w('#button28').enable();
            }, 3000);
            
        } catch (error) {
            console.error("Failed to update post:", error);
            $w('#button28').label = "Error saving";
            $w('#button28').enable();
        }
    });

    // ==========================================
    // HELPER FUNCTIONS 
    // ==========================================

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

    async function loadExistingLinkedFamily(operationId) {
        try {
            let results = await wixData.queryReferenced('Import3', operationId, 'linkedFamily');
            if (results.items.length > 0) {
                selectedFamily = results.items[0];
                updateRepeaterUI();
            }
        } catch (error) {
            console.error("Could not load linked family:", error);
        }
    }

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

    function clearFamilyForm() {
        $w('#headOffamilyInput').value = "";
        $w('#familyDescriptionInput').value = "";
        $w('#staffNotes').value = "";
        $w('#primaryMailingAddressInput').value = "";
        $w('#phone').value = "";
        $w('#directionsOrPhysAddress').value = "";
        $w('#email').value = "";
    }

    function populateFamilyForm(data) {
        $w('#headOffamilyInput').value = data.headOfFamily || "";
        $w('#familyDescriptionInput').value = data.familyDescription || "";
        $w('#staffNotes').value = data.staffNotes || "";
        $w('#primaryMailingAddressInput').value = data.primaryMailingAddress || "";
        $w('#phone').value = data.phone || "";
        $w('#directionsOrPhysAddress').value = data.directionsPhysicalLocation || "";
        $w('#email').value = data.email || "";
    }

    function getFamilyFormData() {
        return {
            headOfFamily: $w('#headOffamilyInput').value, 
            familyDescription: $w('#familyDescriptionInput').value,
            staffNotes: $w('#staffNotes').value,
            primaryMailingAddress: $w('#primaryMailingAddressInput').value,
            phone: $w('#phone').value,
            directionsPhysicalLocation: $w('#directionsOrPhysAddress').value,
            email: $w('#email').value
        };
    }
});