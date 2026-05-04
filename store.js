const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');

function readAll() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Ошибка чтения db.json:', err);
        return [];
    }
}

function saveAll(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Ошибка записи db.json:', err);
        return false;
    }
}

function getAllItems() {
    return readAll();
}

function getItemById(id) {
    const items = readAll();
    return items.find(item => item.id === id) || null;
}

function addItem(newItem) {
    const items = readAll();
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const itemToAdd = { id: newId, ...newItem };
    items.push(itemToAdd);
    if (saveAll(items)) {
        return itemToAdd;
    }
    return null;
}

function updateItem(id, updatedData) {
    const items = readAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    const updatedItem = { id: items[index].id, ...updatedData };
    items[index] = updatedItem;
    
    if (saveAll(items)) {
        return updatedItem;
    }
    return null;
}

function deleteItem(id) {
    const items = readAll();
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    items.splice(index, 1);
    return saveAll(items);
}

module.exports = {
    getAllItems,
    getItemById,
    addItem,
    updateItem,
    deleteItem
};