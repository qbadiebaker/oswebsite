import wixLocationFrontend from 'wix-location-frontend';
import wixData from 'wix-data'; // We don't use this directly here, but it's good practice to import.

// This function runs as soon as the page is ready.
$w.onReady(function () {
    // --- Task 1: Generate a new unique Donor ID ---
    generateUniqueDonorId();

    // --- Task 2: Handle the save button click ---
    setupSaveAndNavigate();
});


/**
 * Generates a unique, human-readable ID and places it in the donorIdInput field.
 * The ID is based on a prefix 'D-' followed by the current timestamp.
 * It also disables the input field so the user cannot change the generated ID.
 */
function generateUniqueDonorId() {
    // Create a unique ID using a prefix and the current date/time in milliseconds.
    const uniqueId = 'DON-' + Date.now(); 
    
    // Set the value of the input field to our new ID.
    $w('#donorIdInput').value = uniqueId;
    
    // Disable the input field to prevent the user from editing it.
    $w('#donorIdInput').disable();
}


/**
 * Sets up the onClick event for the saveButton.
 * This function manually saves the dataset and then navigates to the new item's dynamic page.
 */
function setupSaveAndNavigate() {
    $w('#saveButton').onClick(async () => {
        // Disable the button immediately to prevent double-clicks.
        $w('#saveButton').disable();
        $w('#saveButton').label = "Submitting..."; // Provide user feedback.

        try {
            // The .save() function saves the new item to the collection
            // and returns a promise that resolves with the saved item.
            const savedItem = await $w('#dataset1').save();
            
            // The 'savedItem' object contains all the new donor's data,
            // including the auto-generated link to their dynamic item page.
            
            // The field key for the dynamic page URL is typically 'link-collectionName-titleField'.
            // Replace 'name' if your dynamic page URL uses a different field (like the Donor ID).
            const dynamicPageUrl = savedItem['link-donors-donorId']; 

            if (dynamicPageUrl) {
                // If the URL exists, navigate the user to it.
                wixLocationFrontend.to(dynamicPageUrl);
            } else {
                // This is a fallback in case something is wrong with the dynamic page setup.
                console.error("Could not find the dynamic page URL for the new donor.");
                $w('#saveButton').label = "Error! Could not navigate.";
            }

        } catch (error) {
            // If the save operation fails (e.g., a required field is empty).
            console.error("Error saving donor:", error);
            $w('#saveButton').label = "Save Failed. Try Again.";
            // Re-enable the button so the user can correct the error and try again.
            $w('#saveButton').enable();
        }
    });
}