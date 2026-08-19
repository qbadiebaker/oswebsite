import wixData from 'wix-data';
import wixLocation from 'wix-location';

/** @type {any} */
let currentFamily = null;
/** @type {any} */
let currentRequest = null; 
/** @type {any[]} */
let familyRequests = []; 
let isEditingFamily = false;
let isEditingRequest = false;

$w.onReady(async function () {
    // 1. UI INIT (Must be inside onReady)
    $w('#box281').collapse(); 
    $w('#table1').collapse(); 
    $w('#input15').collapse(); 
    $w('#box248').collapse(); 
    $w('#linkedRequestRepeater').collapse(); 
    $w('#box287').collapse();
    $w('#box19').collapse();

    // 2. BIND REPEATER LOGIC (Must be inside onReady)
    $w('#linkedRequestRepeater').onItemReady(($item, itemData) => {
        let isArchiveMode = $w('#switch5').checked;

        $item('#text13').text = isArchiveMode ? "DELETE" : "ARCHIVE";
        
        $item('#archiveButton').onClick(async () => {
            try {
                if (isArchiveMode) {
                    await wixData.remove('Import3', itemData._id);
                    familyRequests = familyRequests.filter(r => r._id !== itemData._id);
                } else {
                    itemData.archive = true; 
                    await wixData.update('Import3', itemData);
                    let index = familyRequests.findIndex(r => r._id === itemData._id);
                    if (index !== -1) familyRequests[index] = itemData;
                }
                $w('#linkedRequestRepeater').data = [];
                refreshRequestRepeater(); 
            } catch (err) {
                console.error("Action failed:", err);
            }
        });

        $item('#button40').onClick(() => {
            isEditingRequest = true;
            currentRequest = itemData;
            populateRequestForm(itemData);
            $w('#box248').expand();
        });

        let reqTitle = itemData.requestDonationDetails || "Untitled Request";
        let forWho = itemData.forWho || "N/A";
        let details = itemData.requestNotes || "N/A"; 
        let coord = itemData.coordinator || "Unassigned";
        let reqStaffNotes = itemData.staffNotes || "None";
        
        let okiniIcon = (itemData.whichOkini === "Holiday" || itemData.whichOkini === "holiday") ? "🎄 Holiday" : "📦 Regular";
        let websiteStatus = itemData.liveOnWebsite ? "✅ Posted" : "🟧 Not posted";
        let archiveStatus = itemData.archive ? "🗃️ Archived" : "📂 Active";

        let createdString = "Unknown";
        if (itemData._createdDate) {
            let dateObj = new Date(itemData._createdDate);
            createdString = dateObj.toLocaleDateString() + " " + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        let htmlString = `<div style="font-size:15px; line-height:1.6em; margin-bottom: 5px;">
                            <b>${reqTitle}</b> <br>
                            <span style="margin-left: 15px;"><b>For:</b> ${forWho} &nbsp;|&nbsp; <b>Details:</b> ${details}</span><br>
                            <span style="margin-left: 15px;"><b>Coord:</b> ${coord} &nbsp;|&nbsp; ${okiniIcon} &nbsp;|&nbsp; ${websiteStatus} &nbsp;|&nbsp; <b>Status:</b> ${archiveStatus}</span><br>
                            <span style="margin-left: 15px;"><b>Staff Notes:</b> ${reqStaffNotes}</span><br>
                            <span style="margin-left: 15px; font-size: 13px; color: #777;"><b>Created:</b> ${createdString}</span>
                          </div>`;
                          
        $item('#requestInfo').html = htmlString;
    });

    // 3. URL AUTO-FILL
    let queryParams = wixLocation.query;
    if (queryParams.familyId) {
        try {
            currentFamily = await wixData.get('Import4', queryParams.familyId);
            if (currentFamily) {
                isEditingFamily = true;
                populateFamilyForm(currentFamily);
                
                $w('#box287').expand();
                $w('#box19').expand();
                $w('#box281').expand();
                
                await loadFamilyRequests();
            }
        } catch (err) {
            console.error("Failed to load family from URL:", err);
        }
    }

    // 4. FAMILY TOGGLES
    $w('#button38').onClick(() => {
        isEditingFamily = false;
        currentFamily = null;
        clearFamilyForm();
        
        $w('#table1').collapse();
        $w('#input15').collapse();
        $w('#box287').expand();
        $w('#box19').expand();
        $w('#box281').expand();
        
        familyRequests = [];
        refreshRequestRepeater();
    });

    $w('#button39').onClick(() => {
        $w('#box281').collapse();
        $w('#box287').expand();
        $w('#box19').expand();
        $w('#input15').expand();
        $w('#table1').expand();
        loadDefaultFamilies(); 
    });

    $w('#input15').onInput(async () => {
        let keyword = $w('#input15').value;
        if (keyword.length > 1) {
            try {
                let results = await wixData.query('Import4')
                    .contains('headOfFamily', keyword)
                    .or(wixData.query('Import4').contains('familyId', keyword))
                    .or(wixData.query('Import4').contains('phone', keyword))
                    .or(wixData.query('Import4').contains('email', keyword))
                    .limit(10)
                    .find();
                $w('#table1').rows = results.items;
            } catch (error) {
                console.error("Search failed:", error);
            }
        } else {
            loadDefaultFamilies();
        }
    });

    $w('#table1').onRowSelect(async (event) => {
        currentFamily = event.rowData;
        isEditingFamily = true;
        
        populateFamilyForm(currentFamily);
        
        $w('#table1').collapse();
        $w('#input15').collapse();
        $w('#box281').expand();

        await loadFamilyRequests();
    });

    $w('#button37').onClick(async () => {
        $w('#button37').disable();
        $w('#button37').label = "Saving...";

        /** @type {any} */
        let familyData = getFamilyFormData();

        try {
            if (isEditingFamily && currentFamily) {
                familyData._id = currentFamily._id;
                familyData.familyId = currentFamily.familyId;
                currentFamily = await wixData.update('Import4', familyData);
            } else {
                familyData.familyId = "idfam-" + Date.now();
                currentFamily = await wixData.insert('Import4', familyData);
                isEditingFamily = true; 
            }
            $w('#button37').label = "Saved!";
            setTimeout(() => { $w('#button37').label = "Save Family"; $w('#button37').enable(); }, 2000);
        } catch (error) {
            console.error("Failed to save family:", error);
            $w('#button37').label = "Error";
            $w('#button37').enable();
        }
    });

    // 5. REQUEST TOGGLES
    $w('#switch5').onChange(() => refreshRequestRepeater());

    $w('#addNewRequest').onClick(() => {
        if (!currentFamily) return console.warn("Must save or select a family first!");
        isEditingRequest = false;
        currentRequest = null;
        clearRequestForm();
        $w('#box248').expand();
    });

    $w('#button28').onClick(async () => {
        if (!currentFamily) return console.error("No family selected.");
        if (!$w('#input14').value) return console.error("Req title is required");

        $w('#button28').disable();
        $w('#button28').label = "Saving...";

        /** @type {any} */
        let reqData = getRequestFormData();

        try {
            if (isEditingRequest && currentRequest) {
                reqData._id = currentRequest._id;
                reqData.operationId = currentRequest.operationId;
                
                let updatedReq = await wixData.update('Import3', reqData);
                await wixData.replaceReferences('Import3', 'linkedFamily', updatedReq._id, [currentFamily._id]);
                
                let index = familyRequests.findIndex(r => r._id === updatedReq._id);
                if (index !== -1) familyRequests[index] = updatedReq;

            } else {
                reqData.operationId = "OP-" + Date.now();
                let insertedReq = await wixData.insert('Import3', reqData);
                await wixData.insertReference('Import3', 'linkedFamily', insertedReq._id, currentFamily._id);
                familyRequests.unshift(insertedReq);
            }

            $w('#button28').label = "Saved!";
            setTimeout(() => { $w('#button28').label = "Save Request"; $w('#button28').enable(); }, 2000);
            
            $w('#box248').collapse();
            $w('#linkedRequestRepeater').data = [];
            refreshRequestRepeater(); 

        } catch (error) {
            console.error("Failed to save request:", error);
            $w('#button28').label = "Error";
            $w('#button28').enable();
        }
    });

}); // <---- END OF $w.onReady()

// ==========================================
// DATA FETCHING HELPERS 
// ==========================================
async function loadFamilyRequests() {
    if (!currentFamily) return;
    try {
        let res = await wixData.query('Import3')
            .hasSome('linkedFamily', [currentFamily._id])
            .descending('_createdDate')
            .find();
        
        familyRequests = res.items;
        refreshRequestRepeater();
    } catch (err) {
        console.error("Failed to load requests:", err);
    }
}

function refreshRequestRepeater() {
    let isArchiveMode = $w('#switch5').checked;
    
    let activeCount = 0;
    let archiveCount = 0;
    
    familyRequests.forEach((/** @type {any} */ req) => {
        if (req.archive === true) archiveCount++;
        else activeCount++;
    });

    if (familyRequests.length === 0) {
        $w('#text6').text = "Linked Requests: None (create new one below)";
    } else if (activeCount === 0 && archiveCount > 0) {
        $w('#text6').text = "Linked Requests: No active requests (check archive ➔)";
    } else {
        $w('#text6').text = "Linked Requests";
    }
    
    let filteredRequests = familyRequests.filter((/** @type {any} */ req) => {
        let isArchived = req.archive === true; 
        return isArchiveMode ? isArchived : !isArchived;
    });

    $w('#linkedRequestRepeater').data = filteredRequests;

    if (filteredRequests.length > 0) {
        $w('#linkedRequestRepeater').expand();
    } else {
        $w('#linkedRequestRepeater').collapse();
    }
}

async function loadDefaultFamilies() {
    try {
        let res = await wixData.query('Import4').descending('_createdDate').limit(10).find();
        $w('#table1').rows = res.items;
    } catch (error) {
        console.error("Default families load failed", error);
    }
}

// ==========================================
// FORM DATA HANDLERS
// ==========================================
function clearFamilyForm() {
    $w('#input10').value = ""; 
    $w('#textBox2').value = ""; 
    $w('#textBox1').value = ""; 
    $w('#input9').value = ""; 
    $w('#input8').value = ""; 
    $w('#input7').value = ""; 
    $w('#input6').value = ""; 
}

/** @param {any} data */
function populateFamilyForm(data) {
    $w('#input10').value = data.headOfFamily || "";
    $w('#textBox2').value = data.familyDescription || "";
    $w('#textBox1').value = data.staffNotes || "";
    $w('#input9').value = data.primaryMailingAddress || "";
    $w('#input8').value = data.phone || "";
    $w('#input7').value = data.directionsPhysicalLocation || "";
    $w('#input6').value = data.email || "";
}

function getFamilyFormData() {
    return {
        headOfFamily: $w('#input10').value, 
        familyDescription: $w('#textBox2').value,
        staffNotes: $w('#textBox1').value,
        primaryMailingAddress: $w('#input9').value,
        phone: $w('#input8').value,
        directionsPhysicalLocation: $w('#input7').value,
        email: $w('#input6').value
    };
}

function clearRequestForm() {
    $w('#input14').value = ""; 
    $w('#input13').value = ""; 
    $w('#input12').value = ""; 
    $w('#textBox3').value = ""; 
    $w('#dropdown4').value = ""; 
    $w('#dropdown3').value = ""; 
    $w('#switch2').checked = false; 
    $w('#switch3').checked = false; 
}

/** @param {any} data */
function populateRequestForm(data) {
    $w('#input14').value = data.requestDonationDetails || "";
    $w('#input13').value = data.forWho || "";
    $w('#input12').value = data.requestNotes || "";
    $w('#textBox3').value = data.staffNotes || ""; 
    $w('#dropdown4').value = data.coordinator || "";
    $w('#dropdown3').value = data.whichOkini || "";
    $w('#switch2').checked = data.liveOnWebsite || false;
    $w('#switch3').checked = data.archive || false; 
}

function getRequestFormData() {
    let dateString = new Date().toISOString().split('T')[0];

    return {
        requestDonationDetails: $w('#input14').value, 
        forWho: $w('#input13').value,                 
        requestNotes: $w('#input12').value,  
        staffNotes: $w('#textBox3').value, 
        operationType: "Request",                    
        dateRequested: dateString, 
        whichOkini: $w('#dropdown3').value,
        coordinator: $w('#dropdown4').value,
        liveOnWebsite: $w('#switch2').checked, 
        archive: $w('#switch3').checked 
    };
}