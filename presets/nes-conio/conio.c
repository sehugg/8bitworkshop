
#include <stdlib.h>
#include <string.h>
#include <conio.h>
#include <joystick.h>

const char Text [] = "Hello world!";

int main (void)
{
    unsigned char width, height;

    /* Set screen colors */
    (void) bgcolor (COLOR_BLUE);

    /* Clear the screen, put cursor in upper left corner */
    clrscr ();

    /* Ask for the screen size */
    screensize (&width, &height);

    /* Draw a border around the screen */

    /* Top line */
    cputc (CH_ULCORNER);
    chline (width - 2);
    cputc (CH_URCORNER);

    /* Vertical line, left side */
    cvlinexy (0, 1, height - 2);

    /* Bottom line */
    cputc (CH_LLCORNER);
    chline (width - 2);
    cputc (CH_LRCORNER);

    /* Vertical line, right side */
    cvlinexy (width - 1, 1, height - 2);

    /* Write the greeting in the mid of the screen */
    gotoxy ((width - strlen (Text)) / 2, height / 2);
    cprintf ("%s", Text);

    /* Wait for the user to press a button */
    joy_install (joy_static_stddrv);
    while (!joy_read (JOY_1)) ;
    joy_uninstall ();

    /* Clear the screen again */
    clrscr ();

    /* Done */
    return EXIT_SUCCESS;
}
