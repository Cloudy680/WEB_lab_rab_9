const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const store = require('./store');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const ITEMS_PER_PAGE = 5;

function processAnimals(animals, query) {
    let result = [...animals];
    
    const search = query.search || '';
    if (search.trim() !== '') {
        const searchLower = search.toLowerCase().trim();
        result = result.filter(animal => 
            animal.name.toLowerCase().includes(searchLower)
        );
    }
    
    const sort = query.sort || 'asc';
    if (sort === 'asc') {
        result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    } else if (sort === 'desc') {
        result.sort((a, b) => b.name.localeCompare(a.name, 'ru'));
    }
    
    const page = parseInt(query.page) || 1;
    const totalItems = result.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedItems = result.slice(startIndex, endIndex);
    
    return {
        animals: paginatedItems,
        totalItems,
        totalPages,
        currentPage: page,
        search,
        sort
    };
}

// Главная страница зоопарка
app.get('/', (req, res) => {
    const allAnimals = store.getAllItems();
    const {
        animals,
        totalItems,
        totalPages,
        currentPage,
        search,
        sort
    } = processAnimals(allAnimals, req.query);
    
    res.render('index', { 
        title: 'Зоопарк - Управление животными',
        animals: animals,
        currentYear: new Date().getFullYear(),
        currentPage: currentPage,
        totalPages: totalPages,
        totalItems: totalItems,
        search: search,
        sort: sort,
        hasPrevPage: currentPage > 1,
        hasNextPage: currentPage < totalPages,
        prevPage: currentPage - 1,
        nextPage: currentPage + 1
    });
});

// Страница чат-игры
app.get('/game', (req, res) => {
    res.render('chain', { title: 'Словарная цепочка - Чат-игра' });
});

// API маршруты
app.get('/api/items', (req, res) => {
    const allAnimals = store.getAllItems();
    const {
        animals,
        totalItems,
        totalPages,
        currentPage,
        search,
        sort
    } = processAnimals(allAnimals, req.query);
    
    res.json({ 
        success: true, 
        data: animals,
        pagination: {
            totalItems,
            totalPages,
            currentPage,
            itemsPerPage: ITEMS_PER_PAGE
        },
        search,
        sort
    });
});

app.get('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const item = store.getItemById(id);
    if (!item) {
        return res.status(404).json({ success: false, error: 'Не найдено' });
    }
    res.json({ success: true, data: item });
});

app.post('/api/items', (req, res) => {
    const { name, care } = req.body;
    if (!name || !care) {
        return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }
    const newItem = store.addItem({ name, care });
    res.status(201).json({ success: true, data: newItem });
});

app.put('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, care } = req.body;
    const updatedItem = store.updateItem(id, { name, care });
    if (!updatedItem) {
        return res.status(404).json({ success: false, error: 'Не найдено' });
    }
    res.json({ success: true, data: updatedItem });
});

app.delete('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const item = store.getItemById(id);
    if (!item) {
        return res.status(404).json({ success: false, error: 'Не найдено' });
    }
    store.deleteItem(id);
    res.json({ success: true, message: 'Животное "' + item.name + '" удалено' });
});

// Веб-маршруты для CRUD
app.get('/add', (req, res) => {
    res.render('add', { title: 'Добавить животное' });
});

app.get('/view/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const animal = store.getItemById(id);
    
    if (!animal) {
        return res.status(404).render('error', { 
            title: 'Ошибка 404',
            message: 'Животное не найдено'
        });
    }
    
    res.render('view', { 
        title: animal.name,
        animal: animal
    });
});

app.get('/edit/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const animal = store.getItemById(id);
    
    if (!animal) {
        return res.status(404).render('error', { 
            title: 'Ошибка 404',
            message: 'Животное не найдено'
        });
    }
    
    res.render('edit', { 
        title: 'Редактировать: ' + animal.name,
        animal: animal
    });
});

app.post('/add', (req, res) => {
    const { name, care } = req.body;
    
    if (!name || !care) {
        return res.render('add', { 
            title: 'Добавить животное',
            error: 'Пожалуйста, заполните все поля'
        });
    }
    
    const newItem = store.addItem({ name, care });
    res.redirect('/view/' + newItem.id);
});

app.post('/edit/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name, care } = req.body;
    
    if (!name || !care) {
        const animal = store.getItemById(id);
        return res.render('edit', { 
            title: 'Редактировать: ' + animal.name,
            animal: animal,
            error: 'Пожалуйста, заполните все поля'
        });
    }
    
    store.updateItem(id, { name, care });
    res.redirect('/view/' + id);
});

app.post('/delete/:id', (req, res) => {
    const id = parseInt(req.params.id);
    store.deleteItem(id);
    res.redirect('/');
});

// Обработка ошибок 404
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Страница не найдена',
        message: 'Запрашиваемая страница не существует'
    });
});

// Обработка ошибок 500
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Ошибка сервера',
        message: 'Произошла внутренняя ошибка'
    });
});

module.exports = app;