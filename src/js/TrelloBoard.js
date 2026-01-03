class TrelloBoard {
  #draggedCard = null;
  #draggedCardData = null;
  #abortController = null;
  #dropZoneObserver = null;
  #placeholder = null;
  
  static LOCAL_STORAGE_KEY = 'trelloBoardState';

  constructor() {
    this.columns = document.querySelectorAll('.column');
    this.state = this.#loadState();
    this.#init();
  }

  #init() {
    this.#renderCards();
    this.#setupEventListeners();
    this.#setupDragAndDrop();
    this.#setupIntersectionObserver();
  }

  #loadState() {
    try {
      return JSON.parse(localStorage.getItem(TrelloBoard.LOCAL_STORAGE_KEY)) ?? {
        column1: [],
        column2: [],
        column3: [],
      };
    } catch {
      return { column1: [], column2: [], column3: [] };
    }
  }

  #saveState() {
    localStorage.setItem(TrelloBoard.LOCAL_STORAGE_KEY, JSON.stringify(this.state));
  }

  #renderCards() {
    this.columns.forEach(column => {
      const columnId = column.id;
      const cardsContainer = column.querySelector('.cards');
      
      this.state[columnId] ??= [];
      
      const fragment = document.createDocumentFragment();
      
      this.state[columnId].forEach((cardText, index) => {
        fragment.append(this.#createCardElement(columnId, cardText, index));
      });
      
      cardsContainer.replaceChildren(fragment);
    });
  }

  #createCardElement(columnId, text, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    card.dataset.column = columnId;
    card.dataset.index = index;
    card.dataset.text = text;
    
    const content = document.createElement('span');
    content.className = 'card-content';
    content.textContent = text;
    card.append(content);
    
    const actions = document.createElement('div');
    actions.className = 'card-actions';
    
    const editButton = document.createElement('button');
    editButton.className = 'edit-card';
    editButton.setAttribute('aria-label', 'Edit card');
    editButton.textContent = '✎';
    editButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#enableCardEdit(card, columnId, index);
    });
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-card';
    deleteButton.setAttribute('aria-label', 'Delete card');
    deleteButton.textContent = '✖';
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#deleteCard(columnId, index);
    });
    
    actions.append(editButton);
    actions.append(deleteButton);
    card.append(actions);
    
    card.addEventListener('dragstart', this.#handleDragStart.bind(this));
    card.addEventListener('dragend', this.#handleDragEnd.bind(this));
    
    return card;
  }

  #setupEventListeners() {
    this.columns.forEach(column => {
      const addCardContainer = column.querySelector('.add-card-container');
      
      const addCardButton = addCardContainer?.querySelector('.add-card');
      const cancelButton = addCardContainer?.querySelector('.cancel-add-card');
      const textarea = addCardContainer?.querySelector('.add-card-textarea');

      addCardButton?.addEventListener('click', () => this.#toggleCardInput(addCardContainer));
      cancelButton?.addEventListener('click', () => this.#hideCardInput(addCardContainer));
      
      textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.#addCardFromInput(column.id, addCardContainer);
        } else if (e.key === 'Escape') {
          this.#hideCardInput(addCardContainer);
        }
      });
    });

    document.addEventListener('click', (e) => {
      this.columns.forEach(column => {
        const addCardContainer = column.querySelector('.add-card-container');
        const textarea = addCardContainer?.querySelector('.add-card-textarea');
        
        if (addCardContainer && textarea?.style.display === 'block' && 
            !addCardContainer.contains(e.target)) {
          const text = textarea.value.trim();
          text 
            ? this.#addCardFromInput(column.id, addCardContainer)
            : this.#hideCardInput(addCardContainer);
        }
      });
    }, { capture: true });
  }

  #toggleCardInput(container) {
    const textarea = container.querySelector('.add-card-textarea');
    const addCardButton = container.querySelector('.add-card');
    const cancelButton = container.querySelector('.cancel-add-card');
    
    if (addCardButton.textContent === '+ Add another card') {
      textarea.style.display = 'block';
      cancelButton.style.display = 'inline-block';
      addCardButton.textContent = 'Add card';
      textarea.focus();
    } else {
      this.#addCardFromInput(container.closest('.column').id, container);
    }
  }

  #addCardFromInput(columnId, container) {
    const textarea = container.querySelector('.add-card-textarea');
    const text = textarea.value.trim();
    
    if (text) {
      this.state[columnId] = [...(this.state[columnId] ?? []), text];
      this.#saveState();
      this.#renderCards();
    }
    
    this.#hideCardInput(container);
  }

  #hideCardInput(container) {
    const textarea = container.querySelector('.add-card-textarea');
    const addCardButton = container.querySelector('.add-card');
    const cancelButton = container.querySelector('.cancel-add-card');
    
    textarea.value = '';
    textarea.style.display = 'none';
    cancelButton.style.display = 'none';
    addCardButton.textContent = '+ Add another card';
  }

  #deleteCard(columnId, index) {
    this.state[columnId] = this.state[columnId].filter((_, i) => i !== index);
    this.#saveState();
    this.#renderCards();
  }

  #enableCardEdit(card, columnId, index) {
    if (card.querySelector('.edit-input')) return;
    
    const content = card.querySelector('.card-content');
    const currentText = this.state[columnId][index];
    
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-input';
    textarea.value = currentText;
    
    content.replaceWith(textarea);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    
    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    
    const saveEdit = () => {
      const newText = textarea.value.trim();
      
      if (newText && newText !== currentText) {
        this.state[columnId][index] = newText;
        this.#saveState();
        this.#renderCards();
      } else {
        textarea.replaceWith(content);
      }
      
      this.#abortController?.abort();
    };
    
    textarea.addEventListener('blur', saveEdit, { signal });
    
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textarea.blur();
      } else if (e.key === 'Escape') {
        textarea.replaceWith(content);
        this.#abortController?.abort();
      }
    }, { signal });
    
    card.style.pointerEvents = 'none';
    signal.addEventListener('abort', () => {
      card.style.pointerEvents = '';
    }, { once: true });
  }

  #setupDragAndDrop() {
    this.columns.forEach(column => {
      const cardsContainer = column.querySelector('.cards');
      
      cardsContainer.addEventListener('dragover', this.#handleDragOver.bind(this));
      cardsContainer.addEventListener('dragleave', this.#handleDragLeave.bind(this));
      cardsContainer.addEventListener('drop', this.#handleDrop.bind(this));
    });
  }

  #handleDragStart(e) {
    this.#draggedCard = e.target.closest('.card');
    if (!this.#draggedCard) return;
    
    this.#draggedCardData = {
      columnId: this.#draggedCard.dataset.column,
      index: Number.parseInt(this.#draggedCard.dataset.index, 10),
      text: this.#draggedCard.dataset.text
    };
    
    this.#draggedCard.classList.add('dragging');
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(this.#draggedCardData));
    
    requestAnimationFrame(() => {
      // Используем visibility вместо opacity чтобы сохранить размер
      this.#draggedCard?.style.setProperty('visibility', 'hidden');
    });
  }

  #handleDragEnd() {
    this.#draggedCard?.classList.remove('dragging');
    this.#draggedCard?.style.removeProperty('visibility');
    this.#draggedCard = null;
    
    this.#cleanupDragState();
  }

  #handleDragOver(e) {
    e.preventDefault();
    if (!this.#draggedCardData) return;
    
    e.dataTransfer.dropEffect = 'move';
    
    const cardsContainer = e.currentTarget;
    const column = cardsContainer.closest('.column');
    
    requestAnimationFrame(() => {
      // Удаляем существующий placeholder в этой колонке
      column.querySelectorAll('.card-placeholder').forEach(el => el.remove());
      
      const cards = Array.from(cardsContainer.children)
        .filter(child => child.classList.contains('card'));
      
      let insertPosition = null;
      
      if (cards.length === 0) {
        // Если нет карточек, вставляем в начало
        insertPosition = { type: 'start', element: cardsContainer };
      } else {
        // Проверяем каждую карточку для определения позиции вставки
        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          const rect = card.getBoundingClientRect();
          const cardMiddle = rect.top + rect.height / 2;
          
          if (e.clientY < cardMiddle) {
            insertPosition = { type: 'before', element: card };
            break;
          }
        }
        
        // Если курсор ниже всех карточек, вставляем в конец
        if (!insertPosition) {
          insertPosition = {type: 'after', element: cards[cards.length - 1]};
        }
      }
      
      // Создаем или обновляем placeholder
      if (!this.#placeholder) {
        this.#placeholder = document.createElement('div');
        this.#placeholder.className = 'card-placeholder';
        this.#placeholder.setAttribute('aria-hidden', 'true');
      }
      
      // Вставляем placeholder в правильную позицию
      if (insertPosition.type === 'start') {
        cardsContainer.prepend(this.#placeholder);
      } else if (insertPosition.type === 'before') {
        insertPosition.element.before(this.#placeholder);
      } else {
        insertPosition.element.after(this.#placeholder);
      }
      
      cardsContainer.classList.add('drag-over');
    });
  }

  #handleDragLeave(e) {
    const cardsContainer = e.currentTarget;
    
    // Проверяем, покинули ли мы контейнер или перешли на дочерний элемент
    if (!cardsContainer.contains(e.relatedTarget)) {
      cardsContainer.classList.remove('drag-over');
      if (this.#placeholder && !cardsContainer.contains(this.#placeholder)) {
        this.#placeholder.remove();
        this.#placeholder = null;
      }
    }
  }

  #handleDrop(e) {
    e.preventDefault();
    
    let draggedCardData = this.#draggedCardData;
    
    if (!draggedCardData) {
      try {
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
          draggedCardData = JSON.parse(data);
        }
      } catch {
        console.warn('Не удалось получить данные из dataTransfer');
        return;
      }
    }
    
    if (!draggedCardData) return;
    
    const cardsContainer = e.currentTarget;
    const column = cardsContainer.closest('.column');
    const targetColumnId = column.id;
    
    // Определяем индекс для вставки на основе placeholder
    let newIndex = 0;
    const cards = Array.from(cardsContainer.children)
      .filter(child => child.classList.contains('card'));
    
    if (this.#placeholder && this.#placeholder.parentNode === cardsContainer) {
      // Находим позицию placeholder среди карточек
      const allElements = Array.from(cardsContainer.children);
      const placeholderIndex = allElements.indexOf(this.#placeholder);
      
      // Подсчитываем сколько карточек находится перед placeholder
      newIndex = 0;
      for (let i = 0; i < placeholderIndex; i++) {
        if (allElements[i].classList.contains('card')) {
          newIndex++;
        }
      }
    } else {
      // Если нет placeholder, вставляем в конец
      newIndex = cards.length;
    }
    
    this.#cleanupDragState();
    this.#moveCardToPosition(draggedCardData, targetColumnId, newIndex);
  }

  #cleanupDragState() {
    if (this.#placeholder) {
      this.#placeholder.remove();
      this.#placeholder = null;
    }
    
    document.querySelectorAll('.cards.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }

  #moveCardToPosition(draggedCardData, targetColumnId, newIndex) {
    const { columnId: sourceColumnId, index: sourceIndex, text } = draggedCardData;
    
    this.#draggedCardData = null;
    
    if (!this.state[sourceColumnId]?.[sourceIndex]) {
      console.warn('Карточка не найдена в источнике:', { sourceColumnId, sourceIndex });
      return;
    }
    
    // Если перемещаем внутри той же колонки
    if (sourceColumnId === targetColumnId) {
      const columnCards = [...this.state[sourceColumnId]];
      
      // Удаляем карточку из исходной позиции
      const [movedCard] = columnCards.splice(sourceIndex, 1);
      
      // Корректируем индекс вставки, если удалили карточку перед целевой позицией
      const adjustedIndex = sourceIndex < newIndex ? newIndex - 1 : newIndex;
      
      // Вставляем карточку на новую позицию
      columnCards.splice(adjustedIndex, 0, movedCard);
      
      // Обновляем состояние
      this.state = {
        ...this.state,
        [sourceColumnId]: columnCards
      };
    } else {
      // Если перемещаем в другую колонку
      const sourceColumnCards = [...this.state[sourceColumnId]];
      const targetColumnCards = [...(this.state[targetColumnId] ?? [])];
      
      // Удаляем из исходной колонки
      const [movedCard] = sourceColumnCards.splice(sourceIndex, 1);
      
      // Вставляем в целевую колонку
      const insertIndex = Math.min(newIndex, targetColumnCards.length);
      targetColumnCards.splice(insertIndex, 0, movedCard);
      
      // Обновляем состояние
      this.state = {
        ...this.state,
        [sourceColumnId]: sourceColumnCards,
        [targetColumnId]: targetColumnCards
      };
    }
    
    this.#saveState();
    this.#renderCards();
  }

  #setupIntersectionObserver() {
    this.#dropZoneObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          entry.target.classList.toggle('drop-zone-visible', entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );
    
    document.querySelectorAll('.cards').forEach(container => {
      this.#dropZoneObserver.observe(container);
    });
  }

  destroy() {
    this.#abortController?.abort();
    this.#dropZoneObserver?.disconnect();
    
    this.columns.forEach(column => {
      const addCardContainer = column.querySelector('.add-card-container');
      
      addCardContainer?.querySelector('.add-card')?.replaceWith(
        addCardContainer.querySelector('.add-card').cloneNode(true)
      );
      
      addCardContainer?.querySelector('.cancel-add-card')?.replaceWith(
        addCardContainer.querySelector('.cancel-add-card').cloneNode(true)
      );
      
      addCardContainer?.querySelector('.add-card-textarea')?.replaceWith(
        addCardContainer.querySelector('.add-card-textarea').cloneNode(true)
      );
    });
  }
}

export default TrelloBoard;
