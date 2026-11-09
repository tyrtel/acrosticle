# Sample puzzles

Public-domain acrostics used by the app ("Try the sample puzzle") and as golden test fixtures.

| File                    | What it is                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `diplo-crostic-37.json` | Hand transcription of Diplo-Crostic No. 37 (_State_ magazine, July 1986), in puzzle-file format |
| `diplo-crostic-37.jpg`  | The source scan (public domain, via Wikimedia Commons / Internet Archive)                       |

The JSON uses the **puzzle-file format** (`parsePuzzleFile` in `@acrosticle/protocol`): grid rows in the
compact format (`12V` = square 12, clue V; `#` = black square), plus the clue list. Misprints in the
original are corrected in the file and recorded under `errata`.
