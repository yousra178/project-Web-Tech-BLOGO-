console.log("comments.js loaded");

function openComments(button) {
    const postId = button.dataset.postId;
    document
        .getElementById("comments-panel-" + postId)
        .classList.add("open");
}

function closeComments(button) {
    const postId = button.dataset.postId;
    document
        .getElementById("comments-panel-" + postId)
        .classList.remove("open");
}

function toggleMenu(btn) {
    const comment = btn.closest(".comment");
    comment.classList.toggle("show-menu");
    comment.classList.remove("show-edit");
}
function toggleEdit(btn) {
    const comment = btn.closest(".comment");
    comment.classList.remove("show-menu");
    comment.classList.toggle("show-edit");
}

function toggleReply(btn) {
    const comment = btn.closest(".comment");
    comment.classList.toggle("show-reply");
}

function toggleReplyMenu(btn) {
    const reply = btn.closest(".reply");
    reply.classList.toggle("show-menu");
    reply.classList.remove("show-edit");
    reply.classList.remove("show-reply");
}


function submitCommentPanel(e, form) {
    e.preventDefault();

    const $form = $(form);
    const $panel = $form.closest(".comments-panel");
    const panelId = $panel.attr("id");

    $.post(form.action, $form.serialize(), function () {
        $("#" + panelId).load(
            location.href + " #" + panelId + " > *",
            function () {
                $("#" + panelId).addClass("open");
            }
        );
    });
}

function submitCommentPost(e, form) {
    e.preventDefault();

    const $form = $(form);
    const postId = $form.find('input[name="post_id"]').val();
    const panelId = "comments-panel-" + postId;

    $.post(form.action, $form.serialize(), function () {
        // reset textarea
        $form.find("textarea").val("");

        // reload panel so new comment appears
        $("#" + panelId).load(
            location.href + " #" + panelId + " > *"
        );
    });
}

