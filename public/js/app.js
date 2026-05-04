function deleteAnimal(id, animalName) {
    if (confirm('Вы уверены, что хотите удалить животное "' + animalName + '"?')) {
        fetch('/api/items/' + id, {
            method: 'DELETE'
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.success) {
                alert('Животное успешно удалено');
                window.location.href = '/';
            } else {
                alert('Ошибка: ' + data.error);
            }
        })
        .catch(function(error) {
            alert('Ошибка при удалении');
        });
    }
}