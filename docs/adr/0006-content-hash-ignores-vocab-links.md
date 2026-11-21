# The content hash ignores vocab-link markup

An exercise's stored state is dropped when its content hash changes (SPEC §10.3). Vocab links are markup inside prompts and texts (`[[valigia|v-valigia]]`), so hashing them as written would reset every exercise the moment links are added, including lesson 1, where real progress exists. The hash therefore treats `[[word|v-id]]` as plain `word`, just as it already leaves out notes: links, like notes, explain content without changing what is asked.

A reader may expect any edit to a prompt to reset its exercise. This is the deliberate exception; removing it would silently reset progress whenever links are added or retargeted.
