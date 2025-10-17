# shellcheck disable=SC2148

BASH_PROMPT="$HOME/.bash_prompt"
ALIASES="$HOME/.bash_aliases"
INPUTRC="$HOME/.inputrc"
BASHRC="$HOME/.bashrc"
HELIX_CONFIG="$HOME/.config/helix/config.toml"

log "Creating $BASH_PROMPT file..."
cat <<'EOF' >"$BASH_PROMPT"
__bash_prompt() {
    local userpart='`export XIT=$? \
        && [ ! -z "${GITHUB_USER:-}" ] && echo -n "\[\033[0;32m\]@${GITHUB_USER:-} " || echo -n "\[\033[0;32m\]\u " \
        && [ "$XIT" -ne "0" ] && echo -n "\[\033[1;31m\]➜" || echo -n "\[\033[0m\]➜"`'
    local gitbranch='`\
        if [ "$(git config --get devcontainers-theme.hide-status 2>/dev/null)" != 1 ] && [ "$(git config --get codespaces-theme.hide-status 2>/dev/null)" != 1 ]; then \
            export BRANCH="$(git --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git --no-optional-locks rev-parse --short HEAD 2>/dev/null)"; \
            if [ "${BRANCH:-}" != "" ]; then \
                echo -n "\[\033[0;36m\](\[\033[1;31m\]${BRANCH:-}" \
                && if [ "$(git config --get devcontainers-theme.show-dirty 2>/dev/null)" = 1 ] && \
                    git --no-optional-locks ls-files --error-unmatch -m --directory --no-empty-directory -o --exclude-standard ":/*" > /dev/null 2>&1; then \
                        echo -n " \[\033[1;33m\]✗"; \
                fi \
                && echo -n "\[\033[0;36m\]) "; \
            fi; \
        fi`'
    local lightblue='\[\033[1;34m\]'
    local removecolor='\[\033[0m\]'
    PS1="${userpart} ${lightblue}\w ${gitbranch}${removecolor}\n❯ "
    unset -f __bash_prompt
}
__bash_prompt
export PROMPT_DIRTRIM=4

# Check if the terminal is xterm
if [[ "$TERM" == "xterm" ]]; then
    # Function to set the terminal title to the current command
    preexec() {
        local cmd="${BASH_COMMAND}"
        echo -ne "\033]0;${USER}@${HOSTNAME}: ${cmd}\007"
    }

    # Function to reset the terminal title to the shell type after the command is executed
    precmd() {
        echo -ne "\033]0;${USER}@${HOSTNAME}: ${SHELL}\007"
    }

    # Trap DEBUG signal to call preexec before each command
    trap 'preexec' DEBUG

    # Append to PROMPT_COMMAND to call precmd before displaying the prompt
    PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }precmd"
fi
EOF

log "Creating $ALIASES file..."
cat <<'EOF' >"$ALIASES"
alias ls="lsd --color auto"
alias ll="lsd -alF --color auto"
alias la="lsd -A --color auto"
alias cat="bat --color auto --style plain"
alias hx="hx --vsplit"
alias helix=hx
alias vim=hx
EOF

log "Creating $INPUTRC file..."
cat <<'EOF' >"$INPUTRC"
$include /etc/inputrc

set blink-matching-paren on
set colored-completion-prefix on
set completion-ignore-case on
set completion-map-case on
set show-all-if-unmodified on
set show-all-if-ambiguous on
TAB: menu-complete
"\e[Z": menu-complete-backward
EOF

log "Creating $BASHRC..."
cat <<'EOF' >"$BASHRC"
case $- in
    *i*) ;;
      *) return;;
esac

shopt -s globstar
shopt -s checkwinsize
shopt -s histappend
HISTCONTROL=ignoreboth
HISTSIZE=-1
HISTFILESIZE=-1
HISTTIMEFORMAT="%FT%T "

PROMPT_COMMAND="history -a; history -c; history -r; $PROMPT_COMMAND"

[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

if [ -z "${debian_chroot:-}" ] && [ -r /etc/debian_chroot ]; then
  debian_chroot=$(cat /etc/debian_chroot)
fi

case "$TERM" in
xterm-color | *-256color) color_prompt=yes ;;
esac

if [ -n "$force_color_prompt" ]; then
  if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
    color_prompt=yes
  else
    color_prompt=
  fi
fi

if [ "$color_prompt" = yes ]; then
  PS1='${debian_chroot:+($debian_chroot)}\[$(tput setaf 39)\]\u\[$(tput setaf 81)\]@\[$(tput setaf 77)\]\h \[$(tput setaf 226)\]\w \[$(tput sgr0)\]\n❯ '
else
  PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
unset color_prompt force_color_prompt

case "$TERM" in
xterm* | rxvt*)
  PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1"
  ;;
*) ;;
esac

if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
fi

if [ -f ~/.bash_aliases ]; then
  . ~/.bash_aliases
fi

if [ -f ~/.bash_env ]; then
  . ~/.bash_env
fi

if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi
# bash theme - partly inspired by https://github.com/ohmyzsh/ohmyzsh/blob/master/themes/robbyrussell.zsh-theme
__bash_prompt() {
    local userpart='`export XIT=$? \
        && [ ! -z "${GITHUB_USER:-}" ] && echo -n "\[\033[0;32m\]@${GITHUB_USER:-} " || echo -n "\[\033[0;32m\]\u " \
        && [ "$XIT" -ne "0" ] && echo -n "\[\033[1;31m\]➜" || echo -n "\[\033[0m\]➜"`'
    local gitbranch='`\
        if [ "$(git config --get devcontainers-theme.hide-status 2>/dev/null)" != 1 ] && [ "$(git config --get codespaces-theme.hide-status 2>/dev/null)" != 1 ]; then \
            export BRANCH="$(git --no-optional-locks symbolic-ref --short HEAD 2>/dev/null || git --no-optional-locks rev-parse --short HEAD 2>/dev/null)"; \
            if [ "${BRANCH:-}" != "" ]; then \
                echo -n "\[\033[0;36m\](\[\033[1;31m\]${BRANCH:-}" \
                && if [ "$(git config --get devcontainers-theme.show-dirty 2>/dev/null)" = 1 ] && \
                    git --no-optional-locks ls-files --error-unmatch -m --directory --no-empty-directory -o --exclude-standard ":/*" > /dev/null 2>&1; then \
                        echo -n " \[\033[1;33m\]✗"; \
                fi \
                && echo -n "\[\033[0;36m\]) "; \
            fi; \
        fi`'
    local lightblue='\[\033[1;34m\]'
    local removecolor='\[\033[0m\]'
    PS1="${userpart} ${lightblue}\w ${gitbranch}${removecolor}\n❯ "
    unset -f __bash_prompt
}
__bash_prompt
export PROMPT_DIRTRIM=4

# Check if the terminal is xterm
if [[ "$TERM" == "xterm" ]]; then
    # Function to set the terminal title to the current command
    preexec() {
        local cmd="${BASH_COMMAND}"
        echo -ne "\033]0;${USER}@${HOSTNAME}: ${cmd}\007"
    }

    # Function to reset the terminal title to the shell type after the command is executed
    precmd() {
        echo -ne "\033]0;${USER}@${HOSTNAME}: ${SHELL}\007"
    }

    # Trap DEBUG signal to call preexec before each command
    trap 'preexec' DEBUG

    # Append to PROMPT_COMMAND to call precmd before displaying the prompt
    PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }precmd"
fi

source <(bat --completion bash)
source <(fzf --bash)

EOF

log "Creating helix config..."
mkdir -p "$(dirname "$HELIX_CONFIG")"
cat <<'EOF' >"$HELIX_CONFIG"
theme = "catppuccin-mocha"

[editor]
editor-config = true
line-number = "absolute"
mouse = true
shell = ["bash", "-c"]
auto-completion = true
auto-format = true
preview-completion-insert = true
completion-replace = false
true-color = true
text-width = 120
default-line-ending = "lf"
insert-final-newline = true
indent-heuristic = "hybrid"
undercurl = true
trim-final-newlines = false
auto-pairs = true
popup-border = "menu"
rulers = [80,120]
trim-trailing-whitespace = true
path-completion = true
end-of-line-diagnostics = "hint"

[editor.inline-diagnostics]
cursor-line = "warning"

[editor.indent-guides]
render = true
character = "⸽" # Some characters that work well: "▏", "┆", "┊", "⸽", "╎"
skip-levels = 1

[editor.cursor-shape]
insert = "bar"
normal = "block"
select = "underline"
EOF
