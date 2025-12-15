
function liked(button) {
    const postId = button.dataset.postId;
    let liked = Number(button.dataset.liked);// 0 of 1
    const newLiked = liked === 1 ? 0 : 1;
}


function toggleBookmark(button) {
    let saved = Number(button.dataset.saved); // 0 of 1
    let newSaved = saved === 1 ? 0 : 1;

    button.dataset.saved = newSaved;
    button.classList.toggle("saved", newSaved === 1);
}
