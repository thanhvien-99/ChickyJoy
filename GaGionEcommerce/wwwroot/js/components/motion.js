export function initMotion(){
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');observer.unobserve(e.target);}}),{threshold:.07});
 document.querySelectorAll('.section-heading,.occasion-section,.deals-section,.faq-strip,.restaurants-section').forEach(el=>{el.classList.add('joy-reveal');observer.observe(el);});
 document.addEventListener('click',event=>{const button=event.target.closest('.primary-btn,.add-btn');if(!button)return;button.classList.remove('joy-tap');void button.offsetWidth;button.classList.add('joy-tap');});
}
