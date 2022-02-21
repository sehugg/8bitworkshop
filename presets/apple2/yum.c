/*
 * YUM
 *
 * Jeff Tranter <tranter@pobox.com>
 *
 * Written in standard C but designed to run on the Apple Replica 1
 * or Apple II using the CC65 6502 assembler.
 *
 * Copyright 2012-2015 Jeff Tranter
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License four the specific language governing permissions and
 * limitations under the License.
 *
 * TODO:
 * - optimize code size (e.g. use char instead of int)
 * - make computer player smarter
 *
 * Revision History:
 *
 * Version  Date         Comments
 * -------  ----         --------
 * 0.0      25 Jul 2012  Started coding
 * 0.1      31 Jul 2012  First release.
 * 0.2      02 Sep 2015  Apple II improvements.
 *
 */

#include <ctype.h>
#include <errno.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef __CC65__
#include <conio.h>
#endif
#ifndef __CC65__
#include <time.h>
#endif

/*

YUM - a variation of the game Yahtzee

Up to 3 players (set at compile time, limited by screen size).
Players can be the computer.

*/

/* CONSTANTS */

/* Sentinel value indicating that a category has not been played yet. */
#define UNSET -1

/* Maximum number of players */
#define MAXPLAYERS 3

/* Number of categories in score. */
#define MAXCATEGORY 15

/* Number of dice. */
#define MAXDICE 5

/* Number of rounds. */
#define MAXROUNDS 12

/* Number of dice rolls. */
#define MAXROLLS 3

/* VARIABLES */

/* Number of human players. */
int numHumanPlayers;

/* Number of computer players. */
int numComputerPlayers;

/* Current round. */
int currentRound;

/* Current player. */
int player;

/* Current dice roll number (1-3). */
int roll;

/* Seed value for random numbers. */
int randomSeed;

/* Returns true if a given player is a computer. */
bool isComputerPlayer[MAXPLAYERS];

/* Names of each player. */
char playerName[MAXPLAYERS][10];

/* 2D array of values given player number and category. */
int scoreSheet[MAXPLAYERS][MAXCATEGORY];

/* Current dice for player. */
int dice[MAXDICE];

/* General purpose buffer for user input. */
char buffer[40];

/* Names of computer players. */
char *computerNames[MAXPLAYERS] = { "Apple 1", "Apple 2", "Woz" };

/* Names of categories. */
char *labels[MAXCATEGORY] = { "1's", "2's", "3's", "4's", "5's", "6's", "Sub-total", "Bonus", "Low Straight", "High Straight", "Low Score", "High Score", "Full House", "YUM", "Total" };

/* FUNCTIONS */

/* Mark all dice to be rolled. */
void markAllDiceToBeRolled()
{
    int p;

    for (p = 0; p < MAXDICE; p++) {
        dice[p] = UNSET;
    }
}

/*
 * Initialize score table to initial values for start of a game. Don't
 * clear player names since we may be starting a new game with the
 * same players.
 */
void initialize()
{
    int p, c;

    for (p = 0; p < MAXPLAYERS; p++) {
        for (c = 0; c < MAXCATEGORY; c++) {
            scoreSheet[p][c] = UNSET;
        }
    }

    /* Initialize all dice to UNSET state too. */
    markAllDiceToBeRolled();
}

/* Clear the screen. */
void clearScreen()
{
#if defined(__APPLE2__) || defined(__C64__)
    clrscr();
#else
    int i;

    for (i = 0; i < 24; ++i)
        printf("\n");
#endif
}

/* Print a string, wait for user to press enter, then continue. */
void pressEnter(char *s)
{

    /* Default string is printed if s is 0. */
    if (s == 0) {
        printf("\nPress <Return> to continue");
    } else {
        printf("%s", s);
    }

#ifdef __CC65__
    /* On CC65 platform use keyPressed() routine and use this to set the random seed. */

#if defined(__APPLE2__) || defined(__C64__)
    while (!kbhit()) {
        randomSeed++;
    }
    cgetc();
#else
    while (!keypressed()) {
        randomSeed++;
    }
    readkey();
#endif
    printf("\n");
#else
    fgets(buffer, sizeof(buffer)-1, stdin);
#endif
}

/* Print a score value as a number. If set to UNSET, display blanks. */
void printField(int i)
{
    if (i == UNSET) {
        printf("        ");
    } else {
        printf("%-8d", i);
    }
}

/* Print a numeric row of the score card. */
void printRow(char *label, int row)
{
    int p;

    printf("%-15s", label);
    for (p = 0; p < numHumanPlayers + numComputerPlayers; p++) {
        printField(scoreSheet[p][row]);
    }
    printf("\n");
}

/* Update scores after a turn, i.e. recalculate totals. */
void updateScore()
{
    int p, i, total;

    for (p = 0; p < numHumanPlayers + numComputerPlayers; p++) {

        /* Calculate sub-total. */
        total = 0;
        for (i = 0; i <= 5 ; i++) {
            if (scoreSheet[p][i] != -1) {
                total += scoreSheet[p][i];
            }
        }
        scoreSheet[p][6] = total;

        /* Calculate bonus. */
        if (scoreSheet[p][6] >= 63) {
            scoreSheet[p][7] = 25;
        } else {
            scoreSheet[p][7] = 0;
        }

        /* Calculate total. */
        total = 0;
        for (i = 6; i <= 13 ; i++) {
            if (scoreSheet[p][i] != -1) {
                total += scoreSheet[p][i];
            }
        }
        scoreSheet[p][14] = total;
    }
}

/* Display the current score card. Displays final results if all categories are played. */
void displayScore()
{
    int i;

    printf("Score after %d of 12 rounds:\n\n", currentRound);
    printf("Roll           ");
    for (i = 0; i < numHumanPlayers + numComputerPlayers; i++) {
        printf("%-8s", playerName[i]);
    }
    printf("\n");

    for (i = 0; i < MAXCATEGORY; i++) {
        printRow(labels[i], i);
    }
}

/* Display help information. Needs to fit on 40 char by 22 line screen. */
void displayHelp()
{
    printf("%s",
           "This is a computer version of the game\n"
           "YUM, similar to games known as Yahtzee,\n"
           "Yacht and Generala. Each player rolls\n"
           "five dice up to three times and then\n"
           "applies the dice toward a category to\n"
           "claim points. The game has 12 rounds\n"
           "during which each player attempts to\n"
           "claim the most points in each category.\n"
           "\n"
           "The winner is the person scoring the\n"
           "most points at the end of the game.\n"
           "\n"
           "This version supports up to three\n"
           "players of which any can be human or\n"
           "computer players.\n");

    pressEnter(0);
    clearScreen();

    printf("%s",
           "Categories are as follows:\n\n"
           "1's through 6's - dice of same type\n"
           "Low Straight (15) - 1 2 3 4 5\n"
           "High Straight (20) - 2 3 4 5 6\n"
           "Low Score - total 21 or more\n"
           "High Score - total 22 or more\n"
           "Full House (25) - 3 of a kind and pair\n"
           "YUM (30) - 5 dice the same\n\n"
           "Bonus of 25 points if upper section\n"
           "is 63 or more.\n\n");
}

/* Return location of number i in dice array. */
int find(int die)
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] == die)
            return i;
    }
    return UNSET;
}

/* Return number of dice that are n. */
int numberOf(int n)
{
    int i;
    int sum = 0;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] == n) {
            sum += 1;
        }
    }
    return sum;
}

/*
 *  Return if dice form a low straight.
 * The dice must be sorted in order from low to high.
 */
bool haveLowStraight()
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] != i + 1) {
            return false;
        }
    }
    return true;
}

/*
 *  Return if dice form a high straight.
 * The dice must be sorted in order from low to high.
 */
bool haveHighStraight()
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] != i + 2) {
            return false;
        }
    }
    return true;
}

/* Return sum of dice. */
int sum()
{
    int i;
    int sum = 0;

    for (i = 0; i < MAXDICE; i++) {
            sum += dice[i];
    }
    return sum;
}

/* Return if dice contains number i. */
bool contains(int die)
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] == die)
            return true;
    }
    return false;
}

/* Return if dice form a full house. Dice must be sorted in order. */
bool haveFullHouse()
{
    if ((dice[0] == dice[1]) && (dice[1] == dice[2]) && (dice[3] == dice[4]))
        return true;
    if ((dice[0] == dice[1]) && (dice[2] == dice[3]) && (dice[3] == dice[4]))
        return true;
    return false;
}

/* Return if dice form a Yum. */
bool haveYum()
{
    int i;

    for (i = 1; i < MAXDICE; i++) {
        if (dice[i] != dice[0]) {
            return false;
        }
    }
    return true;
}

/* Determine if we have four the same. If so, return the number we have and set d to the dice that is wrong. */
int haveFourTheSame(int *d)
{
    int i, j;

    for (i = 1; i <= 6; i++) {
        if (numberOf(i) == 4) {
            /* Found 4 the same. */
            for (j = 0; j < MAXDICE; j++) {
                /* Find the one that doesn't match. */
                if (dice[j] != i) {
                    *d = j;
                    return i;
                }
            }
        }
    }

    /* We don't have 4 the same. */
    return 0;
}

/* Determine if we have three the same. If so, return the number we have. */
int haveThreeTheSame()
{
    int i;

    for (i = 1; i <= 6; i++) {
        if (numberOf(i) == 3) {
            return i;
        }
    }

    /* We don't have 3 the same. */
    return 0;
}
/* Determine if we have two the same. If so, return the number we have. */
int haveTwoTheSame()
{
    int i;

    for (i = 1; i <= 6; i++) {
        if (numberOf(i) == 2) {
            return i;
        }
    }

    /* We don't have 2 the same. */
    return 0;
}

/*
 * Determine if we almost have a full house. Returns true if so, and
 * sets d to the index of dice that is wrong. e.g. for 22335 would
 * return true and 4.
 */
bool possibleFullHouse(int *d)
{
    /* Three possibilities: ijjkk iijkk iijjk */

    if ((dice[1] == dice[2]) && (dice[3] == dice[4])) {
        *d = 0;
        return true;
    } else if ((dice[0] == dice[1]) && (dice[3] == dice[4])) {
        *d = 2;
        return true;
    } else if ((dice[0] == dice[1]) && (dice[2] == dice[3])) {
        *d = 4;
        return true;
    }

    return false;
}

/*
 * Determine if we almost have a high straight. Returns true if so, and
 * sets d to the index of dice that is wrong. e.g. for 23356 would
 * return true and 2.
 */
bool possibleHighStraight(int *d)
{
    int i;
    int count = 0;

    /* See if each value from 2 to 6 appears. */
    for (i = 2; i <= 6; i++) {
        if (contains(i)) {
            count += 1;
        }
    }

    if (count == 4) {
        /* We have a possible low straight. Now which dice is wrong? Either one that occurs twice or is a 1. */
        for (i = 0; i < MAXDICE; i++) {
            if ((dice[i] == 1) || (numberOf(dice[i]) == 2)) {
                *d = i;
                return true;
            }
        }
    }
    return false;
}

/* Same as above but for low straight, i.e. 12345 */
bool possibleLowStraight(int *d)
{
    int i;
    int count = 0;

    /* See if each value from 1 to 5 appears. */
    for (i = 1; i <= 5; i++) {
        if (contains(i)) {
            count += 1;
        }
    }

    if (count == 4) {
        /* We have a possible low straight. Now which dice is wrong? Either one that occurs twice or is a 6. */
        for (i = 0; i < MAXDICE; i++) {
            if ((dice[i] == 6) || (numberOf(dice[i]) == 2)) {
                *d = i;
                return true;
            }
        }
    }
    return false;
}

/* Return if we have three of a kind. If so, set the dice that are not the same to UNSET. */
bool handleThreeOfAKind()
{
    int i, kind;

    for (i = 6; i > 0; i--) {
        if (numberOf(i) == 3) {
            kind = i;
            for (i = 0; i < MAXDICE; i++) {
                if (dice[i] != kind) {
                    dice[i] = UNSET;
                }
            }
            return true;
        }
    }
    return false;
}

/* Return if we have two of a kind. If so, set the dice that are not the same to UNSET. */
bool handleTwoOfAKind()
{
    int i, kind;

    for (i = 6; i > 0; i--) {
        if (numberOf(i) == 2) {
            kind = i;
            for (i = 0; i < MAXDICE; i++) {
                if (dice[i] != kind) {
                    dice[i] = UNSET;
                }
            }
            return true;
        }
    }
    return false;
}

/* Keep the single highest die in a category we have not used. If none, return false. */
bool keepHighest()
{
    int i, kind;

    for (i = MAXDICE - 1; i >= 0; i--) {
        if (scoreSheet[player][i] == UNSET) {
            kind = i - 1;
            for (i = 0; i < MAXDICE; i++) {
                if (dice[i] != kind) {
                    dice[i] = UNSET;
                }
            }
            return true;
        }
    }
    return false;
}

/* Display dice being kept and being rolled again. */
void displayDiceRolledAgain()
{
    int i;

    printf("%s keeps:", playerName[player]);

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] != UNSET)
            printf(" %d", dice[i]);
    }

    printf("\n");
}

/* Display a string and get an input string. */
char *promptString(char *string)
{
    printf("%s?", string);
    fgets(buffer, sizeof(buffer)-1, stdin);
    buffer[strlen(buffer)-1] = '\0'; /* Remove newline at end of string */
    return buffer;
}

/* Display a string and prompt for a number. Number must be in range
 * min through max. Returns numeric value.
 */
int promptNumber(char *string, int min, int max)
{
    int val = 0;
    char *endptr = 0;

    while (true) {
        printf("%s (%d-%d)?", string, min, max);
        fgets(buffer, sizeof(buffer)-1, stdin);
        errno = 0;
        val = strtol(buffer, &endptr, 10);
        if ((errno == 0) /*&& (endptr != buffer)*/ && (val >= min) && (val <= max))
            return val;
    }
}

/*
 * Ask number and names of players. Sets values of numPlayers,
 *  isComputerPlayer, and playerName.
 */
void setPlayers()
{
    int i;

    numHumanPlayers = promptNumber("How many human players", 0, MAXPLAYERS);
    if (numHumanPlayers < MAXPLAYERS) {
        numComputerPlayers = promptNumber("How many computer players", (numHumanPlayers == 0) ? 1 : 0, MAXPLAYERS - numHumanPlayers);
    } else {
        numComputerPlayers = 0;
    }

    for (i = 0; i < numHumanPlayers; i++) {
        snprintf(buffer, sizeof(buffer), "Name of player %d", i+1);
        strncpy(playerName[i], promptString(buffer), sizeof(playerName[i]) - 1);
        playerName[i][strlen(playerName[i])] = 0; /* May need to add terminating null */
        isComputerPlayer[i] = false;
    }

    for (i = numHumanPlayers; i < numHumanPlayers + numComputerPlayers; i++) {
        strcpy(playerName[i], computerNames[i - numHumanPlayers]);
        isComputerPlayer[i] = true;
    }
}

/* Display a string and prompt for Y or N. Return boolean value. */
bool promptYesNo(char *string)
{
    while (true) {
        printf("%s (y/n)?", string);
        fgets(buffer, sizeof(buffer)-1, stdin);
        if (toupper(buffer[0]) == 'Y')
            return true;
        if (toupper(buffer[0]) == 'N')
            return false;
    }
}

/* Compare function for sorting. */
int compare(const void *i, const void *j)
{
    return *(int *)(i) - *(int *)(j);
}

/* Sort dice. */
void sortDice()
{
    qsort(dice, sizeof(dice) / sizeof(dice[0]), sizeof(dice[0]), compare);
}

/* Display what dice user has. */
void displayDice()
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        printf(" %d", dice[i]);
    }
    printf("\n");
}

/* Ask what what dice to roll again. Return false if does not want to roll any. */
int askPlayerDiceToRollAgain()
{
    int i;
    bool valid;
    int tempDice[MAXDICE];

    /* Make a copy of the dice in case we have to undo changes after an error. */
    for (i = 0; i < MAXDICE; i++) {
        tempDice[i] = dice[i];
    }

    while (true) {

        printf("Enter dice to roll again or\nD for dice or S for score:");
        fgets(buffer, sizeof(buffer)-1, stdin);
        buffer[strlen(buffer)-1] = '\0'; /* Remove newline at end of string */

        /* Entering 'S' will display the current score. Useful if you can't remember what categories you used. */
        if (toupper(buffer[0]) == 'S') {
            displayScore();
            continue;
        }

        /* Entering 'D' will display the dice. Useful if it scrolled off the screen. */
        if (toupper(buffer[0]) == 'D') {
            displayDice();
            continue;
        }

        /* If empty string, no dice to roll again and we return with false status. */
        if (strlen(buffer) == 0) {
            return false;
        }

        valid = true;
        /* First validate the input line. */
        for (i = 0; i < strlen(buffer); i++) {
            /* Validate character. */
            if ((buffer[i] != ' ') && (buffer[i] != ',') && ((buffer[i] < '1') || (buffer[i] > '6'))) {
                printf("Invalid input: '%c', Try again.\n", buffer[i]);
                valid = false;
                break;
            }
        }

        /* Try again if not valid. */
        if (!valid) {
            continue;
        }

        /* Now examine the input line */
        for (i = 0; i < strlen(buffer); i++) {
            /* Skip any spaces or commas */
            if ((buffer[i] == ' ') || (buffer[i] == ',')) {
                continue;
            }

            /* Does it match a die we have? If so, unset it to mark it to be rolled again. */
            if (contains(buffer[i] - '0')) {
                dice[find(buffer[i] - '0')] = UNSET;
            } else {
                printf("You don't have a '%c', Try again.\n", buffer[i]);
                valid = false;
                /* Revert the dice to the original saved values since we may have changed it before the error was detected. */
                for (i = 0; i < MAXDICE; i++) {
                    dice[i] = tempDice[i];
                }
                break;
           }
        }

        /* Try again if not valid. */
        if (!valid) {
            continue;
        }

        return true;
    }
}

/* Generate random number from low and high inclusive, e.g. randomNumber(1, 6) for a die. Calls rand(). */
int randomNumber(int low, int high)
{
    return rand() % high + low;
}

/* Roll 1 die. */
int rollDie()
{
    return randomNumber(1, 6);
}

/* Roll the dice. Only some dice need to be rolled, the ones that are set to UNSET. */
void rollDice()
{
    int i;

    for (i = 0; i < MAXDICE; i++) {
        if (dice[i] == UNSET) {
            dice[i] = randomNumber(1, 6);
        }
    }
}

/* Play a category. */
void playCategory(int category)
{
    if (scoreSheet[player][category] != UNSET) {
        printf("Internal error: Tried to play a category that was already selected!\n");
        return;
    }

    switch (category) {
    case 0: case 1: case 2: case 3: case 4: case 5:
        /* Score is number of the dice times the die value. */
        scoreSheet[player][category] = numberOf(category + 1) * (category + 1);
        break;
    case 8: /* Low straight. */
        scoreSheet[player][category] = haveLowStraight() ? 15 : 0;
        break;
    case 9: /* High straight. */
        scoreSheet[player][category] = haveHighStraight() ? 20 : 0;
        break;
    case 10: /* Low score. Must be 21 or more and less than high score. */
        scoreSheet[player][category] = (sum() >= 21) ? sum() : 0;
        if ((sum() >= 21) && ((scoreSheet[player][10] == UNSET) || (sum() < scoreSheet[player][11]))) {
            scoreSheet[player][category] = sum();
        } else {
            scoreSheet[player][category] = 0;
        }
        break;
    case 11: /* High score. Must be 22 or more and more than low score. */
        if ((sum() >= 22) && (sum() > scoreSheet[player][10])) {
            scoreSheet[player][category] = sum();
        } else {
            scoreSheet[player][category] = 0;
        }
        break;
    case 12: /* Full House. */
        scoreSheet[player][category] = haveFullHouse() ? 25 : 0;
        break;
    case 13: /* YUM. */
        scoreSheet[player][category] = haveYum() ? 30 : 0;
        break;
    }
}

/* Ask what category to claim (only show possible ones). */
int humanPickCategory()
{
    int category;
    char buffer[50];

    printf("\n");

    for (category = 0; category < MAXCATEGORY; category++) {
        /* Some categories need to be skipped. */
        if ((category == 6) || (category == 7) || (category == 14)) {
            continue;
        }

        if (scoreSheet[player][category] == UNSET) {
            printf("%2d  - %s\n", category + 1, labels[category]);
        }
    }

    while (true) {
        snprintf(buffer, sizeof(buffer), "\n%s, What category do\nyou want to claim?", playerName[player]);
        category = promptNumber(buffer, 1, MAXCATEGORY-1) - 1;
        if (scoreSheet[player][category] != UNSET) {
            printf("You already used that category.\nTry again.\n");
        } else {
            break;
        }
    }

    return category;
}

/* Display winner. */
void displayWinner()
{
    int max = UNSET;
    int winner = UNSET;
    int p;

    for (p = 0; p < numHumanPlayers + numComputerPlayers; p++) {
        if (scoreSheet[p][14] > max) {
            max = scoreSheet[p][14];
            winner = p;
        }
    }

    printf("\n");

    /* Display the winner. */
    if (numHumanPlayers + numComputerPlayers == 3) {
        if ((scoreSheet[0][14] == scoreSheet[1][14]) && (scoreSheet[1][14] == scoreSheet[2][14])) {
            printf("It was a three way tie!\n");
        } else if ((scoreSheet[0][14] == scoreSheet[1][14]) && (scoreSheet[0][14] == max)) {
            printf("It was a tie between %s and %s\n", playerName[0], playerName[1]);
        } else if ((scoreSheet[1][14] == scoreSheet[2][14]) && (scoreSheet[1][14] == max)) {
            printf("It was a tie between %s and %s\n", playerName[1], playerName[2]);
        } else if ((scoreSheet[0][14] == scoreSheet[2][14]) && (scoreSheet[0][14] == max)) {
            printf("It was a tie between %s and %s\n", playerName[0], playerName[2]);
        } else {
            printf("The winner is %s.\n", playerName[winner]);
        }
    }

    if (numHumanPlayers + numComputerPlayers == 2) {
        if (scoreSheet[0][14] == scoreSheet[1][14]) {
            printf("It was a tie between %s and %s\n", playerName[0], playerName[1]);
        } else {
            printf("The winner is %s.\n", playerName[winner]);
        }
    }

    /* Display player's scores. */
    for (p = 0; p < numHumanPlayers + numComputerPlayers; p++) {
        printf("%s has %d points.\n", playerName[p], scoreSheet[p][14]);
    }
}

/*
 * Computer decides what dice to roll again (by setting them to
 * UNSET). Returns false if does not want to roll any.
*/
bool askComputerDiceToRollAgain()
{
    int n, d;

    /* If we have YUM and have not claimed it, don't roll any. */
    if (haveYum() && scoreSheet[player][13] == UNSET) {
        return false;
    }

    /* If we have all the same and have not claimed that category don't roll any. */
    if (haveYum() && scoreSheet[player][dice[0] - 1] == UNSET) {
        return false;
    }

    /* If we have a full house and have not claimed that category don't roll any. */
    if (haveFullHouse() && scoreSheet[player][12] == UNSET) {
        return false;
    }

    /* If we have a high straight and have not claimed that category don't roll any. */
    if (haveHighStraight() && scoreSheet[player][9] == UNSET) {
        return false;
    }

    /* If we have a low straight and have not claimed that category don't roll any. */
    if (haveLowStraight() && scoreSheet[player][8] == UNSET) {
        return false;
    }

    /* If we have 4 the same and have not claimed that category then roll the remaining die. */
    if ((n = haveFourTheSame(&d)) && scoreSheet[player][dice[n - 1]] == UNSET) {
        dice[d] = UNSET;
        return true;
    }

    /* If we almost have a full house and have not claimed that category then roll the remaining die. */
    if (possibleFullHouse(&d) && scoreSheet[player][12] == UNSET) {
        dice[d] = UNSET;
        return true;
    }

    /* If we almost have a high straight and have not claimed that category then roll the remaining die. */
    if (possibleHighStraight(&d) && scoreSheet[player][9] == UNSET) {
        dice[d] = UNSET;
        return true;
    }

    /* If we almost have a low straight and have not claimed that category then roll the remaining die. */
    if (possibleLowStraight(&d) && scoreSheet[player][8] == UNSET) {
        dice[d] = UNSET;
        return true;
    }

    /* If we have 3 the same, roll the remaining dice. */
    if (handleThreeOfAKind()) {
        return true;
    }

    /* If we have 2 the same, roll the remaining dice. */
    if (handleTwoOfAKind()) {
        return true;
    }

    /* Keep the 1 highest dice in a category we have not completed. */
    if (keepHighest()) {
        return true;
    }

    /* If all else fails, roll them all again */
    markAllDiceToBeRolled();
    return true;
}

/* Computer decides what category to play. */
int computerPickCategory()
{
    int n, d;

    /* Try for YUM. */
    if (haveYum() && scoreSheet[player][13] == UNSET) {
        return 13;
    }

    /* Try all the same. */
    if (haveYum() && scoreSheet[player][dice[0] - 1] == UNSET) {
        return dice[0] - 1;
    }

    /* Try full house. */
    if (haveFullHouse() && scoreSheet[player][12] == UNSET) {
        return 12;
    }

    /* Try high straight. */
    if (haveHighStraight() && scoreSheet[player][9] == UNSET) {
        return 9;
    }

    /* Try low straight. */
    if (haveLowStraight() && scoreSheet[player][8] == UNSET) {
        return 8;
    }

    /* Try 4 the same. */
    if ((n = haveFourTheSame(&d)) && scoreSheet[player][n - 1] == UNSET) {
        return n - 1;
    }

    /* Try 3 the same. */
    if ((n = haveThreeTheSame()) && scoreSheet[player][n - 1] == UNSET) {
        return n - 1;
    }

    /* Try high score. Must be 22 or more. */
    if ((sum() >= 22) && (scoreSheet[player][11] == UNSET) && (sum() > scoreSheet[player][10])) {
        return 11;
    }

    /* Try low score. Must be 21 or more. */
    if ((sum() >= 21) && (scoreSheet[player][10] == UNSET) && ((scoreSheet[player][11] == UNSET) || (sum() < scoreSheet[player][11]))) {
        return 10;
    }

    /* Try the highest 2 the same. */
    if ((n = haveTwoTheSame()) && scoreSheet[player][n - 1] == UNSET) {
        return n - 1;
    }

    /* Try the highest 1 the same. */
    for (d = MAXDICE - 1; d >= 0; d--) {
        if (scoreSheet[player][dice[d] - 1] == UNSET) {
            return dice[d] - 1;
        }
    }

    /* Throw away the lowest unused category. */
    for (d = 0; d < MAXCATEGORY; d++) {
        if (scoreSheet[player][d] == UNSET) {
            return d;
        }
    }

    return 0;
}

/* Set random seed for the rand() function. */
void setRandomSeed()
{
#ifdef __CC65__

    /* On embedded CC65 systems like the Replica use time taken for key to be pressed. */
    srand(randomSeed);

#else

    /* On desktop systems use system time as random seed. */
    srand(time(0));

#endif
}

/* Main program. */
int main(void)
{
    initialize();
    clearScreen();

    printf("%s",
          "#     # #     # #     #\n"
          " #   #  #     # ##   ##\n"
          "  # #   #     # # # # #\n"
          "   #    #     # #  #  #\n"
          "   #    #     # #     #\n"
          "   #    #     # #     #\n"
          "   #     #####  #     #\n"
          "\n\nWelcome to YUM!\n");

    if (promptYesNo("Do you want instructions")) {
        clearScreen();
        displayHelp();
    }

    setPlayers();

    while (true) {

        pressEnter("Press <Return> to start the game");
        setRandomSeed();

        for (currentRound = 1; currentRound <= MAXROUNDS; currentRound++) {
            for (player = 0; player < numHumanPlayers + numComputerPlayers; player++) {

                clearScreen();
                snprintf(buffer, sizeof(buffer), "%s's turn. Press <Return> to roll", playerName[player]);
                pressEnter(buffer);
                markAllDiceToBeRolled();

                for (roll = 1; roll <= MAXROLLS; roll++) {
                    bool ret;

                    rollDice();
                    sortDice();
                    if (roll == 1) {
                        printf("First roll is:");
                    } else if (roll == 2) {
                        printf("Second roll is:");
                    } else {
                        printf("Last roll is:");
                    }
                    displayDice();
                    if (roll < 3) {
                        if (isComputerPlayer[player]) {
                            ret = askComputerDiceToRollAgain();
                            displayDiceRolledAgain();
                        } else {
                            ret = askPlayerDiceToRollAgain();
                        }
                        /* Player wants to roll again? */
                        if (ret == false) {
                            break;
                        }
                    }
                }

                if (isComputerPlayer[player]) {
                    int c;
                    c = computerPickCategory();
                    printf("%s plays %s\n", playerName[player], labels[c]);
                    playCategory(c);
                    pressEnter(0);
                } else {
                    playCategory(humanPickCategory());
                }

            }
            clearScreen();
            updateScore();
            displayScore();
            pressEnter(0);
        }

        displayWinner();

        pressEnter(0);
        clearScreen();

        if (!promptYesNo("Would you like to play again")) {
            break;
        }

        if (!promptYesNo("Same players as last time")) {
            setPlayers();
        }

        initialize();
    }
    return 0;
}
