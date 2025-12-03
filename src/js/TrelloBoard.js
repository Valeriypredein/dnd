class TrelloBoard {
  constructor() {
    this.columns = document.querySelectorAll(".column");
    this.localStorageKey = "trelloBoardState";
    this.state = JSON.parse(localStorage.getItem(this.localStorageKey)) || {
      column1: [],
      column2: [],
      column3: [],
    };
    this.renderCards();
    this.addCardListeners();
    this.initDragAndDrop();
  }

  renderCards() {
    this.columns.forEach((column) => {
      const columnId = column.id;
      const cardsContainer = column.querySelector(".cards");
      cardsContainer.innerHTML = "";
      this.state[columnId].forEach((cardText, index) => {
        const card = this.createCard(columnId, cardText, index);
        cardsContainer.appendChild(card);
      });
    });
  }

  createCard(columnId, cardText, index) {
    const card = document.createElement("div");
    card.className = "card";
    card.draggable = true;
    card.textContent = cardText;
    card.dataset.column = columnId;
    card.dataset.index = index;
    const editButton = document.createElement("span");
    editButton.className = "edit-card";
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => this.editCard(columnId, index));
    card.appendChild(editButton);
    const deleteButton = document.createElement("span");
    deleteButton.className = "delete-card";
    deleteButton.textContent = "✖";
    deleteButton.addEventListener("click", () =>
      this.deleteCard(columnId, index),
    );
    card.appendChild(deleteButton);
    card.addEventListener("dragstart", (e) => this.dragStart(e));
    card.addEventListener("dragend", () => this.dragEnd());
    return card;
  }

  addCardListeners() {
    document.querySelectorAll(".add-card").forEach((addCardButton) => {
      addCardButton.addEventListener("click", () => {
        const columnId = addCardButton.parentElement.id;
        const cardText = prompt("Enter card text:");
        if (cardText) {
          this.state[columnId].push(cardText);
          this.saveState();
          this.renderCards();
        }
      });
    });
  }

  deleteCard(columnId, index) {
    this.state[columnId].splice(index, 1);
    this.saveState();
    this.renderCards();
  }

  editCard(columnId, index) {
    const newText = prompt("Edit card text:", this.state[columnId][index]);
    if (newText !== null) {
      this.state[columnId][index] = newText;
      this.saveState();
      this.renderCards();
    }
  }

  dragStart(e) {
    this.draggedCard = e.target;
    this.sourceColumnId = this.draggedCard.parentElement.parentElement.id;
    this.draggedCard.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    document.body.style.cursor = "grabbing";
  }

  dragEnd() {
    this.draggedCard.classList.remove("dragging");
    this.draggedCard = null;
    this.sourceColumnId = null;
    document.body.style.cursor = "default";
  }

  initDragAndDrop() {
    this.columns.forEach((column) => {
      column.addEventListener("dragover", (e) => this.dragOver(e));
      column.addEventListener("drop", (e) => this.dropCard(e, column));
    });
  }

  dragOver(e) {
    e.preventDefault();
    const cardsContainer = e.target.querySelector(".cards");
    if (!cardsContainer) return;
    const afterElement = this.getDragAfterElement(cardsContainer, e.clientY);
    const card = document.querySelector(".card.dragging");
    if (!card) return;
    if (afterElement == null) {
      cardsContainer.appendChild(card);
    } else if (afterElement.parentElement === cardsContainer) {
      cardsContainer.insertBefore(card, afterElement);
    }
  }

  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".card:not(.dragging)"),
    ];
    return (
      draggableElements.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - (box.top + box.height / 2);
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY },
      ).element || null
    );
  }

  dropCard(e, column) {
    e.preventDefault();
    if (!this.draggedCard) return;
    const targetColumnId = column.id;
    const cardText = this.draggedCard.textContent
      .replace("✖", "")
      .replace("✎", "")
      .trim();
    const sourceColumnIndex = this.state[this.sourceColumnId].indexOf(cardText);
    if (sourceColumnIndex !== -1) {
      this.state[this.sourceColumnId].splice(sourceColumnIndex, 1);
    }
    this.state[targetColumnId].push(cardText);
    this.saveState();
    this.renderCards();
  }

  saveState() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.state));
  }
}

export default TrelloBoard;
