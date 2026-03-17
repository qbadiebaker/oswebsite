import wixData from 'wix-data';
import { session } from 'wix-storage';

// ====================================================================
// --- Configuration ---
const COLLECTIONS = {
    OPERATIONS: "Import3",
    FAMILIES: "Import4",
    INDIVIDUALS: "Import6"
};

const FIELDS = {
    OP_FAMILY_REF: "linkedFamily",
    OP_INDIVIDUAL_REF: "linkedIndividual",
    INDIVIDUAL_FAMILY_REF: "import_4_linked_family_members",
    OKINI_TYPE: "whichOkini",
    COORDINATOR: "coordinator"
};

let checkoutSessionId;
// ====================================================================

$w.onReady(function () {
    console.log("[DEBUG-INIT] Page Ready Fired.");
    initializeSession();
    setupRepeaters(); 
    setupCheckoutForm();
    
    populateFamilyAndIndividualList();
    populateSelectedRequestsRepeater();
});

function initializeSession() {
    let sessionId = session.getItem("checkoutSessionId");
    if (!sessionId) {
        sessionId = String(Date.now());
        session.setItem("checkoutSessionId", sessionId);
        console.log(`[DEBUG-SESSION] New Session Created: ${sessionId}`);
    } else {
        console.log(`[DEBUG-SESSION] Existing Session Found: ${sessionId}`);
    }
    checkoutSessionId = sessionId;
}

// ====================================================================
// --- UI Setup & Event Listeners ---
// ====================================================================
function setupRepeaters() {
    console.log("[DEBUG-INIT] Setting up Repeater 1 & 2 Listeners.");
    
    $w('#repeater1').onItemReady(($item, itemData, index) => {
        // console.log(`[DEBUG-REP1] Populating row index ${index} with ID: ${itemData._id}`);
        
        const requestInfoTextElement = $item('#requestInfoText');
        const contactTextElement = $item('#text148'); 
        let htmlString = "";
        let requestData = null; 

        if (itemData.type === 'family') {
            const familyDetails = itemData.data.familyDetails;
            requestData = itemData.data.familyRequest;
            htmlString = `<p style="font-size:18px;"><strong>${familyDetails.headOfFamily || 'Family'}'s Family</strong></p>
                          <p style="clear: both;"><strong>About:</strong> ${familyDetails.familyDescription || 'N/A'}</p>`;
            if (requestData) {
                htmlString += `<p style="margin-left: 20px;"><strong>Family Need:</strong> ${requestData.requestDonationDetails || 'N/A'}</p>`;
            }
        } else if (itemData.type === 'individual') {
            const individual = itemData.data.individual;
            requestData = itemData.data.request;
            htmlString = `<p style="margin-left: 40px;"><strong>${individual.boyOrGirl || 'Member'}, Age: ${individual.age || ''}</strong><br><strong>Needs:</strong> ${requestData.requestDonationDetails || 'N/A'}<br><strong>Sizes:</strong> ${requestData.sizeDetails || 'N/A'}</p>`;
        }

        requestInfoTextElement.html = htmlString;

        if (requestData && requestData[FIELDS.COORDINATOR]) {
            contactTextElement.text = `Contact: ${requestData[FIELDS.COORDINATOR]}`;
            contactTextElement.expand(); 
        } else {
            contactTextElement.collapse(); 
        }

        if (requestData) {
            const isUrgent = requestData.urgentNeedStatus === true || String(requestData.urgentNeedStatus).toUpperCase() === 'TRUE';
            if (isUrgent) $item('#box172').expand(); else $item('#box172').collapse();

            const switchElement = $item('#switch1');
            switchElement.expand();
            
            // Check if this specific request's session ID matches the user's
            const isSelected = requestData.checkoutSessionId === checkoutSessionId;
            switchElement.checked = isSelected;

            switchElement.onChange(async (event) => {
                const correctOperationId = event.context.itemId; 
                const isChecked = switchElement.checked;
                
                console.log(`[DEBUG-ACTION] Switch Toggled!`);
                console.log(`[DEBUG-ACTION] Row ID Clicked: ${correctOperationId}`);
                console.log(`[DEBUG-ACTION] Switch state is now: ${isChecked}`);

                switchElement.disable(); 
                const newSessionId = isChecked ? checkoutSessionId : null;

                try {
                    const rawItem = await wixData.get(COLLECTIONS.OPERATIONS, correctOperationId);
                    if (!rawItem) {
                        console.error(`[DEBUG-ERROR] Could not find Operation in DB with ID: ${correctOperationId}`);
                        throw new Error("Item not found in database");
                    }
                    
                    console.log(`[DEBUG-ACTION] Updating DB item ${correctOperationId} with session ID: ${newSessionId}`);
                    rawItem.checkoutSessionId = newSessionId;
                    await wixData.update(COLLECTIONS.OPERATIONS, rawItem);
                    
                    await populateSelectedRequestsRepeater();
                } catch (error) {
                    console.error("[DEBUG-ERROR] Failed to update selection:", error);
                    switchElement.checked = !isChecked; // Revert visually
                } finally {
                    switchElement.enable();
                }
            });
        } else {
            $item('#switch1').collapse();
            $item('#box172').collapse();
        }
    });

    $w('#repeater2').onItemReady(($item, itemData) => {
        $item('#button19').onClick(async (event) => {
            const correctOperationId = event.context.itemId;
            console.log(`[DEBUG-REP2-ACTION] Remove clicked for item ID: ${correctOperationId}`);
            
            $item('#button19').disable();
            try {
                const rawItem = await wixData.get(COLLECTIONS.OPERATIONS, correctOperationId);
                rawItem.checkoutSessionId = null;
                await wixData.update(COLLECTIONS.OPERATIONS, rawItem);
                
                await populateSelectedRequestsRepeater();
                await populateFamilyAndIndividualList(); 
            } catch (error) {
                console.error("[DEBUG-ERROR] Failed to remove item:", error);
                $item('#button19').enable();
            }
        });
    });
}

// ====================================================================
// --- Parallel Data Fetching ---
// ====================================================================
async function populateFamilyAndIndividualList() {
    console.log("[DEBUG-DATA] Starting main list fetch...");
    try {
        const familiesResult = await wixData.query(COLLECTIONS.FAMILIES).limit(1000).find();
        const families = familiesResult.items;
        console.log(`[DEBUG-DATA] Found ${families.length} families total.`);

        if (families.length === 0) {
            $w('#repeater1').data = [];
            return;
        }

        const flatList = [];
        const chunkSize = 50; 
        const trackedIds = new Set(); // To check for duplicates

        for (let i = 0; i < families.length; i += chunkSize) {
            const chunk = families.slice(i, i + chunkSize);

            const chunkPromises = chunk.map(async (family) => {
                const familyItems = [];

                const [familyRequestsResult, individualsResult] = await Promise.all([
                    wixData.query(COLLECTIONS.OPERATIONS).hasSome(FIELDS.OP_FAMILY_REF, family._id).isEmpty(FIELDS.OP_INDIVIDUAL_REF).ne(FIELDS.OKINI_TYPE, "holiday").find(),
                    wixData.query(COLLECTIONS.INDIVIDUALS).hasSome(FIELDS.INDIVIDUAL_FAMILY_REF, family._id).find()
                ]);

                const familyRequests = familyRequestsResult.items;
                const individuals = individualsResult.items;

                let hasAnyRegularRequests = familyRequests.length > 0;
                const individualItems = [];

                if (individuals.length > 0) {
                    const indPromises = individuals.map(async (individual) => {
                        const indReqQuery = await wixData.query(COLLECTIONS.OPERATIONS)
                            .hasSome(FIELDS.OP_INDIVIDUAL_REF, individual._id)
                            .ne(FIELDS.OKINI_TYPE, "holiday").find();

                        if (indReqQuery.items.length > 0) {
                            const reqId = indReqQuery.items[0]._id;
                            if (trackedIds.has(reqId)) {
                                console.warn(`[DEBUG-WARNING] DUPLICATE ID FOUND: ${reqId} for individual ${individual.firstName}`);
                            } else {
                                trackedIds.add(reqId);
                                individualItems.push({
                                    _id: reqId,
                                    type: 'individual',
                                    data: { individual, request: indReqQuery.items[0] }
                                });
                            }
                        }
                    });
                    await Promise.all(indPromises);
                    if (individualItems.length > 0) hasAnyRegularRequests = true;
                }

                if (hasAnyRegularRequests) {
                    const famReq = familyRequests.length > 0 ? familyRequests[0] : null;
                    const famIdToUse = famReq ? famReq._id : `fam_${family._id}`;
                    
                    if (trackedIds.has(famIdToUse)) {
                        console.warn(`[DEBUG-WARNING] DUPLICATE ID FOUND: ${famIdToUse} for family ${family.headOfFamily}`);
                    } else {
                        trackedIds.add(famIdToUse);
                        familyItems.push({
                            _id: famIdToUse,
                            type: 'family',
                            data: { familyDetails: family, familyRequest: famReq }
                        });
                        familyItems.push(...individualItems);
                    }
                }
                return familyItems;
            });

            const chunkResults = await Promise.all(chunkPromises);
            chunkResults.forEach(items => flatList.push(...items));
        }

        console.log(`[DEBUG-DATA] Feeding Repeater 1 with ${flatList.length} items.`);
        $w('#repeater1').data = flatList;

    } catch (err) {
        console.error("[DEBUG-ERROR] Error populating request list:", err);
    }
}

async function populateSelectedRequestsRepeater() {
    if (!checkoutSessionId) return;
    console.log(`[DEBUG-REP2] Fetching cart items for session: ${checkoutSessionId}`);

    try {
        const selectedOps = await wixData.query(COLLECTIONS.OPERATIONS)
            .eq("checkoutSessionId", checkoutSessionId)
            .ne(FIELDS.OKINI_TYPE, "holiday")
            .find();

        console.log(`[DEBUG-REP2] Found ${selectedOps.items.length} items for Repeater 2.`);
        
        $w('#repeater2').data = []; 
        $w('#repeater2').data = selectedOps.items || [];
    } catch (err) {
        console.error("[DEBUG-ERROR] Error populating Repeater 2:", err);
    }
}

// ====================================================================
// --- Form Setup ---
// ====================================================================
function setupCheckoutForm() {
    const submitButton = $w('#button20');
    submitButton.disable(); 

    $w('#input1').onInput(validateCheckoutForm);
    $w('#checkboxGroup1').onChange(validateCheckoutForm);
    validateCheckoutForm();

    submitButton.onClick(async () => {
        submitButton.disable();
        submitButton.label = "Processing...";

        try {
            submitButton.label = "Success!";
        } catch (err) {
            submitButton.label = "Error - Please Try Again";
            submitButton.enable(); 
        }
    });
}

function validateCheckoutForm() {
    const isDonorInfoValid = $w('#input1').valid && $w('#checkboxGroup1').valid;
    if (isDonorInfoValid) {
        $w('#button20').enable();
    } else {
        $w('#button20').disable();
    }
}