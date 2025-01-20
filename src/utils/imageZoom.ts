export function setupImageZoom() {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && target.classList.contains('memo-img')) {
      const overlay = document.createElement('div')
      overlay.className = 'img-zoom-overlay'
      
      const img = document.createElement('img')
      img.src = target.getAttribute('src') || ''
      
      overlay.appendChild(img)
      document.body.appendChild(overlay)
      
      overlay.addEventListener('click', () => {
        document.body.removeChild(overlay)
      })
    }
  })
} 