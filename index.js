const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Getting elements
const sourceButton = document.getElementById('choose-source');
const targetButton = document.getElementById('choose-target');
const sourceList = document.getElementById('source-list');
const targetList = document.getElementById('target-list');
const sourceDisplay = document.getElementById('source-panel');
const targetDisplay = document.getElementById('target-panel');
const pageNumberInput = document.getElementById('pageNumber');
const incrementInput = document.getElementById('increment');
const bookNameInput = document.getElementById('bookName');
const sourcePathElement = document.getElementById('source-path');
const targetPathElement = document.getElementById('target-path');
const copyButton = document.getElementById('copy-button');
const copyBisButton = document.getElementById('copy-bis-button');
// Default sorting parameters
const defaultSortSource = { sortBy: 'date', sortOrder: 'ascending' };
const defaultSortTarget = { sortBy: 'date', sortOrder: 'descending' };


// Global watchers
let sourceWatcher = null;
let targetWatcher = null;
let extraPageNumber = 1;

// Functions
function displayImage(directory, filename, displayElement, listElement) {
  displayElement.innerHTML = `<img src="file://${path.join(directory, filename)}" />`;

  // Remove 'selected' class from all list items
  for (let item of listElement.children) {
    item.classList.remove('selected');
  }

  // Add 'selected' class to the list item with the current filename
  const listItem = Array.from(listElement.children).find(item => item.textContent === filename);
  if (listItem) {
    listItem.classList.add('selected');
  }
}

function getFileDetails(directory) {
  const files = fs.readdirSync(directory);
  return files.map(file => ({
    name: file,
    path: path.join(directory, file),
    time: fs.statSync(path.join(directory, file)).mtime.getTime()
  }));
}

function setupFileList(directory, listElement, displayElement, isSource, sortBy = 'date', sortOrder = 'ascending') {
  const fileDetails = getFileDetails(directory);

  // Function to extract page number from file name
  const extractPageNumber = (fileName) => {
    const match = fileName.match(/_(\d+)(?=_|\.\w+$)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Adding page numbers to file details
  fileDetails.forEach(file => {
    file.pageNumber = extractPageNumber(file.name);
  });

  // Determine sorting function
  let sortFunction;
  if (sortBy === 'pageNumber') {
    sortFunction = (a, b) => {
      return sortOrder === 'ascending' ? a.pageNumber - b.pageNumber : b.pageNumber - a.pageNumber;
    };
  } else { // Default to sorting by date
    sortFunction = (a, b) => {
      return sortOrder === 'ascending' ? a.time - b.time : b.time - a.time;
    };
  }

  // Apply the sorting
  fileDetails.sort(sortFunction);

  // Add each file to the list
  fileDetails.forEach((file, index) => {
    const listItem = document.createElement('li');
    listItem.textContent = file.name;
    listItem.addEventListener('click', () => {
      displayImage(directory, file.name, displayElement, listElement);
    });
    listElement.appendChild(listItem);

    // Display the first image by default
    if (index === 0) {
      displayImage(directory, file.name, displayElement, listElement);
    }
  });
}


//function updateFileDisplay(directory, displayElement, listElement, isSource) {
 // const fileDetails = getFileDetails(directory);

  // Sort by time, oldest first if source, newest first if target
 // fileDetails.sort((a, b) => isSource ? a.time - b.time : b.time - a.time);

  // Display the first image
//  if (fileDetails.length > 0) {
 //   displayImage(directory, fileDetails[0].name, displayElement, listElement);
//  }
//}

function clearFileList(listElement) {
  while (listElement.firstChild) {
    listElement.removeChild(listElement.firstChild);
  }
}

// Function to get the selected sort options
function getSortOptions(prefix) {
  const sortBy = document.getElementById(`${prefix}-sort-by`).value;
  const sortOrder = document.getElementById(`${prefix}-sort-order`).value;
  return { sortBy, sortOrder };
}

// Function to update sorting scheme display
function updateSortingSchemeDisplay(prefix, sortBy, sortOrder) {
  const displayElement = document.getElementById(`${prefix}-sorting-scheme`);
  displayElement.textContent = `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Sorting Scheme: ${sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} (${sortOrder.charAt(0).toUpperCase() + sortOrder.slice(1)})`;
}

// Initialize sorting scheme display on load
updateSortingSchemeDisplay('source', defaultSortSource.sortBy, defaultSortSource.sortOrder);
updateSortingSchemeDisplay('target', defaultSortTarget.sortBy, defaultSortTarget.sortOrder);


// Event listeners
sourceButton.addEventListener('click', () => {
  ipcRenderer.send('open-source-dialog');
});

targetButton.addEventListener('click', () => {
  ipcRenderer.send('open-target-dialog');
});

ipcRenderer.on('source-directory-selected', (event, path) => {
  fs.writeFileSync('source.txt', path);

  const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
  const sourcePath = fs.readFileSync('source.txt', 'utf8');
  clearFileList(sourceList);
  setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
  updateSortingSchemeDisplay('source', sortBy, sortOrder);

  sourcePathElement.textContent = path;
});

ipcRenderer.on('target-directory-selected', (event, path) => {
  fs.writeFileSync('target.txt', path);

  // Default sorting for target directory: by date, descending
  const { sortBy, sortOrder } = getSortOptions('target') || defaultSortTarget;
  const targetPath = fs.readFileSync('target.txt', 'utf8');
  clearFileList(targetList);
  setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
  updateSortingSchemeDisplay('target', sortBy, sortOrder);

  targetPathElement.textContent = path;
});


pageNumberInput.addEventListener('change', () => {
  fs.writeFileSync('pageNumber.txt', pageNumberInput.value);
});

incrementInput.addEventListener('change', () => {
  fs.writeFileSync('increment.txt', incrementInput.value);
});

bookNameInput.addEventListener('change', () => {
  fs.writeFileSync('bookName.txt', bookNameInput.value);
});

// Load the directories at startup if they are saved
window.onload = () => {
  try {
    const sourcePath = fs.readFileSync('source.txt', 'utf-8');
    setupFileList(sourcePath, sourceList, sourceDisplay, true);
    sourcePathElement.textContent = sourcePath;

    if (sourceWatcher) {
      sourceWatcher.close();
    }

    sourceWatcher = chokidar.watch(sourcePath, { persistent: true });
    sourceWatcher.on('all', () => {
      const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
      const sourcePath = fs.readFileSync('source.txt', 'utf8');
      clearFileList(sourceList);
      setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
      updateSortingSchemeDisplay('source', sortBy, sortOrder);
    });
    
  } catch (err) {
    console.log('No source directory saved.');
  }

  try {
    const targetPath = fs.readFileSync('target.txt', 'utf-8');
    setupFileList(targetPath, targetList, targetDisplay, false);
    targetPathElement.textContent = targetPath;

    if (targetWatcher) {
      targetWatcher.close();
    }

    targetWatcher = chokidar.watch(targetPath, { persistent: true });
    targetWatcher.on('all', () => {
      const { sortBy, sortOrder } = getSortOptions('target') || defaultSortTarget;
      const targetPath = fs.readFileSync('target.txt', 'utf8');
      clearFileList(targetList);
      setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
      updateSortingSchemeDisplay('target', sortBy, sortOrder);
    });

  } catch (err) {
    console.log('No target directory saved.');
  }

  try {
    const pageNumber = fs.readFileSync('pageNumber.txt', 'utf-8');
    pageNumberInput.value = pageNumber;
  } catch (err) {
    console.log('No page number saved.');
  }

  try {
    const increment = fs.readFileSync('increment.txt', 'utf-8');
    incrementInput.value = increment;
  } catch (err) {
    console.log('No increment saved.');
  }

  try {
    const bookName = fs.readFileSync('bookName.txt', 'utf-8');
    bookNameInput.value = bookName;
  } catch (err) {
    console.log('No book name saved.');
  }

  try {
    extraPageNumber = parseInt(fs.readFileSync('extraPageNumber.txt', 'utf-8'));
} catch (err) {
    console.log('No extra page number saved.');
    fs.writeFileSync('extraPageNumber.txt', extraPageNumber.toString()); // Set a default of 1 if not saved
}
};

// Event listener
// Modify the copy-button event listener
copyButton.addEventListener('click', () => {
    const selectedSourceFile = Array.from(sourceList.children).find(item => item.classList.contains('selected'));
    if (selectedSourceFile) {
      try {
        const pageNumber = fs.readFileSync('pageNumber.txt', 'utf-8');
        pageNumberInput.value = pageNumber;
      } catch (err) {
        console.log('No page number saved.');
      }
        const sourceFile = path.join(sourcePathElement.textContent, selectedSourceFile.textContent);
        const targetFile = path.join(targetPathElement.textContent, `${bookNameInput.value}_${pageNumberInput.value}.jpg`);
        
        // Copy the source file to the target directory
        fs.copyFileSync(sourceFile, targetFile);
        
        // Now move the source file to the "Dump" directory
        const dumpPath = path.join(__dirname, 'Dump');
        
        // Ensure "Dump" directory exists
        if (!fs.existsSync(dumpPath)){
            fs.mkdirSync(dumpPath);
        }

        const dumpedFile = path.join(dumpPath, selectedSourceFile.textContent);
        fs.renameSync(sourceFile, dumpedFile);
        
        // Increment the page number
        const newPageNumber = parseInt(pageNumberInput.value) + parseInt(incrementInput.value);
        pageNumberInput.value = newPageNumber;
        fs.writeFileSync('pageNumber.txt', newPageNumber.toString());

        // Update both displays
        const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
        const sourcePath = fs.readFileSync('source.txt', 'utf8');
        clearFileList(sourceList);
        setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
        updateSortingSchemeDisplay('source', sortBy, sortOrder);

        const targetPath = fs.readFileSync('target.txt', 'utf8');
        clearFileList(targetList);
        setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
        updateSortingSchemeDisplay('target', sortBy, sortOrder);
        
        // Reset the extra page number to 1 and save it to file
        extraPageNumber = 1;
        fs.writeFileSync('extraPageNumber.txt', '1');
    } else {
      const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
      const sourcePath = fs.readFileSync('source.txt', 'utf8');
      clearFileList(sourceList);
      setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
      updateSortingSchemeDisplay('source', sortBy, sortOrder);
      const targetPath = fs.readFileSync('target.txt', 'utf8');
      clearFileList(targetList);
      setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
      updateSortingSchemeDisplay('target', sortBy, sortOrder);
        console.log('No source file selected.');
    }
});


copyBisButton.addEventListener('click', () => {
    const selectedSourceFile = Array.from(sourceList.children).find(item => item.classList.contains('selected'));
    if (selectedSourceFile) {
        // Get the current extra page number
        try {
          const extraPageNumber = fs.readFileSync('extraPageNumber.txt', 'utf-8');
          extraPageNumberInput.value = extraPageNumber;
        } catch (err) {
          console.log('No page number saved.');
        }
        
        const sourceFile = path.join(sourcePathElement.textContent, selectedSourceFile.textContent);
        // Setting the pageNumber back by the value of the increment
        const pageNumber = parseInt(pageNumberInput.value) - parseInt(incrementInput.value);
        const targetFile = path.join(targetPathElement.textContent, `${bookNameInput.value}_Page_${pageNumber}_Extra_${extraPageNumber}.jpg`);
         
        // Copy the source file to the target directory
        fs.copyFileSync(sourceFile, targetFile);
        
        // Now move the source file to the "Dump" directory
        const dumpPath = path.join(__dirname, 'Dump');
        
        // Ensure "Dump" directory exists
        if (!fs.existsSync(dumpPath)){
            fs.mkdirSync(dumpPath);
        }

        const dumpedFile = path.join(dumpPath, selectedSourceFile.textContent);
        fs.renameSync(sourceFile, dumpedFile);
        
        // Increment the extra page number
        extraPageNumber += 1;
        fs.writeFileSync('extraPageNumber.txt', extraPageNumber.toString());
    

        // Update both displays
        const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
        const sourcePath = fs.readFileSync('source.txt', 'utf8');
        clearFileList(sourceList);
        setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
        updateSortingSchemeDisplay('source', sortBy, sortOrder);

        clearFileList(targetList);
        setupFileList(targetPathElement.textContent, targetList, targetDisplay, false);
    } else {
      const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
      const sourcePath = fs.readFileSync('source.txt', 'utf8');
      clearFileList(sourceList);
      setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
      updateSortingSchemeDisplay('source', sortBy, sortOrder);
      const targetPath = fs.readFileSync('target.txt', 'utf8');
      clearFileList(targetList);
      setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
      updateSortingSchemeDisplay('target', sortBy, sortOrder);
        console.log('No source file selected.');
    }
});

const deleteButtonSource = document.getElementById('delete-button-source');

deleteButtonSource.addEventListener('click', () => {
    const selectedSourceFile = Array.from(sourceList.children).find(item => item.classList.contains('selected'));
    if (selectedSourceFile) {
        const sourceFile = path.join(sourcePathElement.textContent, selectedSourceFile.textContent);
        
        // Delete the source file
        try {
            fs.unlinkSync(sourceFile);
            console.log('File deleted successfully');
        } catch(err) {
            console.error('Error occurred while deleting file');
        }

        // Update the source list and display
        const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
        const sourcePath = fs.readFileSync('source.txt', 'utf8');
        clearFileList(sourceList);
        setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
        updateSortingSchemeDisplay('source', sortBy, sortOrder);
    } else {
        console.log('No source file selected.');
    }
});

const deleteButtonTarget = document.getElementById('delete-button-target');

deleteButtonTarget.addEventListener('click', () => {
    const selectedTargetFile = Array.from(targetList.children).find(item => item.classList.contains('selected'));
    if (selectedTargetFile) {
        const targetFile = path.join(targetPathElement.textContent, selectedTargetFile.textContent);
        
        // Delete the target file
        try {
            fs.unlinkSync(targetFile);
            console.log('File deleted successfully');
        } catch(err) {
            console.error('Error occurred while deleting file');
        }

        // Update the target list and display
        const { sortBy, sortOrder } = getSortOptions('target') || defaultSortTarget;
        const targetPath = fs.readFileSync('target.txt', 'utf8');
        clearFileList(targetList);
        setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
        updateSortingSchemeDisplay('target', sortBy, sortOrder);
    } else {
        console.log('No target file selected.');
    }
});





// Event listener for sorting source directory
document.getElementById('sort-source').addEventListener('click', () => {
  const { sortBy, sortOrder } = getSortOptions('source') || defaultSortSource;
  const sourcePath = fs.readFileSync('source.txt', 'utf8');
  clearFileList(sourceList);
  setupFileList(sourcePath, sourceList, sourceDisplay, true, sortBy, sortOrder);
  updateSortingSchemeDisplay('source', sortBy, sortOrder);
});

// Event listener for sorting target directory
document.getElementById('sort-target').addEventListener('click', () => {
  const { sortBy, sortOrder } = getSortOptions('target') || defaultSortTarget;
  const targetPath = fs.readFileSync('target.txt', 'utf8');
  clearFileList(targetList);
  setupFileList(targetPath, targetList, targetDisplay, false, sortBy, sortOrder);
  updateSortingSchemeDisplay('target', sortBy, sortOrder);
});




