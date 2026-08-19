import wixData from 'wix-data';

/** @type {any[]} */
let publicFamiliesWithRequests = []; 

$w.onReady(async function () {
    // 1. CLEAR CACHE & RESET UI
    publicFamiliesWithRequests = [];
    $w('#repeater1').data = [];
    $w('#repeater1').collapse();
    
    // 2. BIND REPEATER (Strict Privacy formatting)
    $w('#repeater1').onItemReady(
        /** 
         * @param {any} $item 
         * @param {any} itemData 
         */
        ($item, itemData) => {
        
        // Extract Public Family Info
        let headName = itemData.headOfFamily || "Unnamed Family";
        let familyDesc = itemData.familyDescription || "No family description provided.";

        let requestsHtml = "";
        let requestsToDisplay = itemData.filteredRequests || [];
        
        if (requestsToDisplay.length > 0) {
            let requestLines = requestsToDisplay.map(
                /** 
                 * @param {any} req 
                 * @param {number} index 
                 */
                (req, index) => {
                
                // Public Request Info Only
                let reqTitle = req.requestDonationDetails || "Untitled Request";
                let forWho = req.forWho || "N/A";
                let details = req.requestNotes || "N/A"; 
                
                // Formatted specifically for donors (clean, no admin metadata)
                return `<div style="margin-bottom: 10px;">
                            <b style="font-size: 16px; color: #222;">${reqTitle}</b> <br>
                            <span style="margin-left: 15px;"><b>For:</b> ${forWho}</span><br>
                            <span style="margin-left: 15px;"><b>Details:</b> ${details}</span>
                        </div>`;
            });
            
            requestsHtml = requestLines.join("<hr style='border: 0; border-top: 1px dashed #ccc; margin: 15px 0;'>");
        } else {
            requestsHtml = "<i style='color: #777; margin-left: 15px;'>This family currently has no active requests.</i>";
        }
        
        // Combine Family Info AND Requests into the single text box
        let finalHtml = `
            <div style="margin-bottom: 12px;">
                <h3 style="font-size: 20px; margin: 0; color: #111;">${headName}</h3>
                <span style="font-size: 15px; font-style: italic; color: #555;">${familyDesc}</span>
            </div>
            <div style="font-size: 15px; line-height: 1.8em;">
                <b style="font-size: 14px; color: #777; text-transform: uppercase;">Active Requests:</b><br>
                ${requestsHtml}
            </div>
        `;
        
        $item('#familyRequestInfo').html = finalHtml;
    });

    // 3. LOAD DATA
    await loadPublicData();

    // 4. EVENT LISTENERS
    // Automatically triggers search as they type (no button needed)
    $w('#input1').onInput(() => applyFiltersAndSort());
    $w('#dropdown1').onChange(() => applyFiltersAndSort());
});

// ==========================================
// DATA FETCHING (WITH PRIVACY FIREWALL)
// ==========================================
async function loadPublicData() {
    try {
        let familyResults = await wixData.query('Import4').limit(150).find();
        let families = familyResults.items;

        publicFamiliesWithRequests = await Promise.all(families.map(async (family) => {
            
            // SECURITY: Only fetch requests that are Live and NOT Archived
            let reqResults = await wixData.query('Import3')
                .hasSome('linkedFamily', [family._id])
                .eq('liveOnWebsite', true) 
                .ne('archive', true)       
                .find();
            
            let requests = reqResults.items;
            
            family.requests = requests;
            
            // Pre-calculate timestamps for the sorting dropdown
            if (requests.length > 0) {
                let times = requests.map((/** @type {any} */ r) => new Date(r._createdDate).getTime());
                family.newestReqTime = Math.max(...times);
                family.oldestReqTime = Math.min(...times);
            } else {
                family.newestReqTime = 0;
                family.oldestReqTime = 0;
            }
            
            return family;
        }));

        applyFiltersAndSort(); 
        $w('#repeater1').expand();

    } catch (error) {
        console.error("Error loading public data:", error);
    }
}

// ==========================================
// FILTERING & SORTING LOGIC
// ==========================================
function applyFiltersAndSort() {
    let searchTerm = $w('#input1').value.toLowerCase(); 
    let sortOrder = $w('#dropdown1').value; // Expected values: "newest", "oldest"

    let filteredData = [];

    for (let i = 0; i < publicFamiliesWithRequests.length; i++) {
        let family = publicFamiliesWithRequests[i];
        let matchingRequests = family.requests || [];
        
        // UX DECISION: Hide families entirely if they have no active/public requests
        if (matchingRequests.length === 0) continue; 

        // SEARCH LOGIC (Strictly limited to 5 specific fields)
        let matchesSearch = true;
        if (searchTerm) {
            let headName = family.headOfFamily ? family.headOfFamily.toLowerCase() : "";
            let famDesc = family.familyDescription ? family.familyDescription.toLowerCase() : "";
            
            let familyMatches = headName.includes(searchTerm) || famDesc.includes(searchTerm);

            let requestsMatch = matchingRequests.some((/** @type {any} */ req) => {
                let reqTitle = req.requestDonationDetails ? req.requestDonationDetails.toLowerCase() : "";
                let forWho = req.forWho ? req.forWho.toLowerCase() : "";
                let notes = req.requestNotes ? req.requestNotes.toLowerCase() : "";
                
                return reqTitle.includes(searchTerm) || forWho.includes(searchTerm) || notes.includes(searchTerm);
            });

            matchesSearch = familyMatches || requestsMatch;
        }

        if (matchesSearch) {
            // Copy requests so we can sort them without messing up the master array
            let sortedReqs = [...matchingRequests];
            
            if (sortOrder === "oldest") {
                sortedReqs.sort((a, b) => new Date(a._createdDate).getTime() - new Date(b._createdDate).getTime());
            } else {
                sortedReqs.sort((a, b) => new Date(b._createdDate).getTime() - new Date(a._createdDate).getTime());
            }

            let familyCopy = { 
                ...family, 
                _id: family._id, 
                filteredRequests: sortedReqs 
            };
            filteredData.push(familyCopy);
        }
    }

    // SORT FAMILIES OVERALL based on dropdown selection
    if (sortOrder === "oldest") {
        filteredData.sort((a, b) => a.oldestReqTime - b.oldestReqTime);
    } else {
        // Default is newest
        filteredData.sort((a, b) => b.newestReqTime - a.newestReqTime);
    }

    $w('#repeater1').data = []; // Clear cache
    $w('#repeater1').data = filteredData;
}