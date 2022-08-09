
#include "common.h"
#include <cbm_petscii_charmap.h>

int matches;	// number of matches remaining
int take;	// # of matches to take on this turn

void print_matches() {
  printf("\nThere are %d matches left.\n", matches);
}

void human_moves() {
  print_matches();
  // loop until we get a valid move
  while (1) {
    printf("\n>> Your turn. Take 1, 2, or 3 matches?");
    // did we get exactly one input value?
    if (scanf("%d", &take) == 1) {
      // is it between 1 and 3?
      if (take >= 1 && take <= 3) {
        // are there not enough matches?
        if (take > matches) {
          printf("Not enough matches! Try again.\n");
          continue; // go back to start of loop
        } else {
          // take the appropriate number of matches
          printf("You took %d matches.\n", take);
          matches -= take;
          break; // break out of loop
        }
      }
    }
    printf("Bad input! Type a number from 1 to 3.\n");
  }
}

void computer_moves() {
  print_matches();
  // simple AI: hard coded if 1-4 matches left
  // otherwise take random number from 1 to 3
  switch (matches) {
    case 1: take = 1; break;
    case 2: take = 1; break;
    case 3: take = 2; break;
    case 4: take = 3; break;
    default: take = (rand() % 3) + 1; break;
  }
  printf("\n<< My turn. I'll take %d matches.\n", take);
  matches -= take;
}

void play_game(void) {
  printf(
    "When it is your turn, you may take\n"
    "1, 2 or 3 matches. I will do the same.\n\n"
    "Whoever takes the last match loses.\n");

  matches = 23;
  // loop until no more matches
  while (matches > 0) {
    // move human, check if they lost
    human_moves();
    if (matches == 0) {
      printf("You lose, turkey!\nBetter luck next time.\n");
      break;
    }
    // move computer, check if they lost
    computer_moves();
    if (matches == 0) {
      printf("I lost! You must be good!\n");
      break;
    }
  }
}

void main(void) {
  clrscr();
  printf("*** 23 MATCHES ***\n\n");
  play_game();
}
