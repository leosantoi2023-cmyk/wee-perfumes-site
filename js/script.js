/**
 * Wee Shops Landing Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Initial Animations On Scroll using IntersectionObserver
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.animate-up');
    animatedElements.forEach(el => observer.observe(el));


    // 2. Countdown logic (restarting every 2h 45m or using a target local storage logic)
    // We'll simulate urgency by starting at 2:45:30 on first load
    
    let targetTime = localStorage.getItem('weeshops_countdown');
    const now = new Date().getTime();

    if (!targetTime || now > targetTime) {
        // Set for 2 hours, 45 minutes, 30 seconds from now
        targetTime = now + (2 * 60 * 60 * 1000) + (45 * 60 * 1000) + (30 * 1000);
        localStorage.setItem('weeshops_countdown', targetTime);
    }

    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    function updateCountdown() {
        const currentTime = new Date().getTime();
        const difference = targetTime - currentTime;

        if (difference <= 0) {
            // Restart the countdown if it reaches zero to keep the page active
            targetTime = currentTime + (2 * 60 * 60 * 1000) + (45 * 60 * 1000) + (30 * 1000);
            localStorage.setItem('weeshops_countdown', targetTime);
        }

        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        hoursEl.innerText = hours < 10 ? '0' + hours : hours;
        minutesEl.innerText = minutes < 10 ? '0' + minutes : minutes;
        secondsEl.innerText = seconds < 10 ? '0' + seconds : seconds;
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();


    // 3. Scarcity Progress Bar Animation
    // Start at a higher width, shrink to 9 units
    const unitsLeftEl = document.getElementById('units-left');
    const progressBar = document.getElementById('progress-bar');
    
    // Total simulated items = 500
    // Target items left = 9
    // Math: 9 / 500 = 1.8%
    
    let currentUnits = 47; // Start simulation from 47
    const targetUnits = 9;

    function animateScarcity() {
        if (currentUnits > targetUnits) {
            // Randomly decrease by 1 to 5 units
            const decrement = Math.floor(Math.random() * 5) + 1;
            currentUnits -= decrement;
            if (currentUnits < targetUnits) currentUnits = targetUnits;

            unitsLeftEl.innerText = currentUnits;
            const percentage = (currentUnits / 500) * 100;
            progressBar.style.width = percentage + '%';

            // Random delay between 5s and 15s before dropping again
            const nextDropDelay = Math.random() * 10000 + 5000;
            if (currentUnits > targetUnits) {
                setTimeout(animateScarcity, nextDropDelay);
            }
        }
    }

    // Initialize progress bar instantly on JS load
    progressBar.style.width = ((currentUnits / 500) * 100) + '%';
    unitsLeftEl.innerText = currentUnits;
    
    // Start dropping after 2 seconds
    setTimeout(animateScarcity, 2000);


    // 4. Reviews Slider / Carousel Logic
    const sliderContainer = document.querySelector('.reviews-slider-container');
    const dots = document.querySelectorAll('.review-dot');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    
    if (sliderContainer && dots.length > 0) {
        let currentPage = 0;
        const totalPages = dots.length;
        
        // Function to scroll to a specific page
        function scrollToPage(pageIndex) {
            const pageWidth = sliderContainer.clientWidth;
            sliderContainer.scrollTo({
                left: pageWidth * pageIndex,
                behavior: 'smooth'
            });
            updateDots(pageIndex);
            currentPage = pageIndex;
        }
        
        // Update dots state
        function updateDots(activeIndex) {
            dots.forEach((dot, index) => {
                if (index === activeIndex) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }
        
        // Listen to click on dots
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                scrollToPage(index);
            });
        });
        
        // Navigation buttons
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 0) {
                    scrollToPage(currentPage - 1);
                } else {
                    scrollToPage(totalPages - 1); // Loop to last
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages - 1) {
                    scrollToPage(currentPage + 1);
                } else {
                    scrollToPage(0); // Loop to first
                }
            });
        }
        
        // Sync dots on manual scroll / swipe
        let scrollTimeout;
        sliderContainer.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const pageWidth = sliderContainer.clientWidth;
                const scrollLeft = sliderContainer.scrollLeft;
                const pageIndex = Math.round(scrollLeft / pageWidth);
                if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < totalPages) {
                    currentPage = pageIndex;
                    updateDots(currentPage);
                }
            }, 100);
        });

        // Handle resize events to prevent snapping desynchronization
        window.addEventListener('resize', () => {
            const pageWidth = sliderContainer.clientWidth;
            sliderContainer.scrollLeft = pageWidth * currentPage;
        });
    }

    // 5. Expand Review Text Logic
    const moreLinks = document.querySelectorAll('.new-review-more-link');
    moreLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const textContainer = link.closest('.new-review-text');
            if (textContainer) {
                textContainer.classList.add('expanded');
            }
        });
    });

    // 6. Kit Image Sliders Logic
    const kitWrappers = document.querySelectorAll('.kit-image-slider-wrapper');
    kitWrappers.forEach(wrapper => {
        const slider = wrapper.querySelector('.kit-image-slider');
        const slides = wrapper.querySelectorAll('.kit-slide-img');
        const dots = wrapper.querySelectorAll('.kit-dot');
        const prevBtn = wrapper.querySelector('.prev-btn');
        const nextBtn = wrapper.querySelector('.next-btn');
        
        if (slider && dots.length > 0) {
            let activeIndex = 0;
            const totalSlides = slides.length;
            
            function showSlide(index) {
                const width = slider.clientWidth;
                slider.scrollTo({
                    left: width * index,
                    behavior: 'smooth'
                });
                updateDots(index);
                activeIndex = index;
            }
            
            function updateDots(index) {
                dots.forEach((dot, dIdx) => {
                    if (dIdx === index) {
                        dot.classList.add('active');
                    } else {
                        dot.classList.remove('active');
                    }
                });
            }
            
            dots.forEach((dot, index) => {
                dot.addEventListener('click', () => {
                    showSlide(index);
                });
            });
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (activeIndex > 0) {
                        showSlide(activeIndex - 1);
                    } else {
                        showSlide(totalSlides - 1);
                    }
                });
            }
            
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (activeIndex < totalSlides - 1) {
                        showSlide(activeIndex + 1);
                    } else {
                        showSlide(0);
                    }
                });
            }
            
            // Sync dots on swipe/scroll
            let scrollTimeout;
            slider.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const width = slider.clientWidth;
                    const index = Math.round(slider.scrollLeft / width);
                    if (index !== activeIndex && index >= 0 && index < totalSlides) {
                        activeIndex = index;
                        updateDots(activeIndex);
                    }
                }, 100);
            });
            
            window.addEventListener('resize', () => {
                const width = slider.clientWidth;
                slider.scrollLeft = width * activeIndex;
            });
        }
    });
});
