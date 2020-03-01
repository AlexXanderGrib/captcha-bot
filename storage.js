module.exports = new (class Storage {
  constructor() {
    this.timeouts = new Map()
    this.codes = new Map()
    this.messagesLeft = new Map()
  }

  add(id, code, cb, delay = 2000) {
    this.messagesLeft.set(id, 10)
    this.timeouts.set(
      id,
      setTimeout(() => {
        cb()
        clearTimeout(this.timeouts.get(id))
        this.clear(id)
      }, delay)
    )
    this.codes.set(id, code)
  }

  decrementMessages(id) {
    const base = this.messagesLeft.get(id)
    const nextValue = base - 1

    this.messagesLeft.set(id, nextValue)
    return nextValue
  }

  solve(id, code) {
    if (
      this.codes.has(id) &&
      this.timeouts.has(id) &&
      code === this.codes.get(id)
    ) {
      clearTimeout(this.timeouts.get(id))
      this.clear(id)
      return true
    }
    return false
  }

  clear(id) {
    this.timeouts.delete(id)
    this.codes.delete(id)
    this.messagesLeft.delete(id)
  }
})()
